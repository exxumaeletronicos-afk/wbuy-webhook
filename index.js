const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
  res.send("Webhook Wbuy online 🚀");
});

function extrairDados(body) {
  return body?.dados || body?.data || body?.payload || body || {};
}

function extrairPedidoId(body, dados) {
  return (
    dados?.pedido_id ||
    dados?.id ||
    dados?.codigo ||
    body?.pedido_id ||
    body?.id ||
    body?.order_id ||
    ""
  ).toString();
}

function extrairCliente(dados) {
  if (typeof dados?.cliente === "string") return dados.cliente;

  return (
    dados?.cliente?.nome ||
    dados?.cliente?.razao ||
    dados?.cliente_nome ||
    dados?.nome ||
    dados?.razao_social ||
    "Cliente não informado"
  );
}

function extrairStatus(dados) {
  if (typeof dados?.status === "string") return dados.status;

  return (
    dados?.status?.nome ||
    dados?.status_nome ||
    dados?.situacao_nome ||
    dados?.situacao ||
    "Status não informado"
  );
}

function extrairValor(dados) {
  const bruto =
    dados?.valor_total ||
    dados?.total ||
    dados?.valor ||
    dados?.pagamento?.valor_total ||
    dados?.pagamento?.total ||
    dados?.pagamento?.valor ||
    0;

  return (
    Number(
      String(bruto)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0
  );
}

// =========================
// WEBHOOK WBUY
// =========================
app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = extrairDados(body);

    console.log("📦 WEBHOOK WBUY RECEBIDO");
    console.log("BODY COMPLETO:", JSON.stringify(body, null, 2));

    const tipo = body?.tipo || body?.type || body?.evento || "wbuy_webhook";
    const pedido_id = extrairPedidoId(body, dados);

    if (!pedido_id) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    await supabase.from("wbuy_eventos").insert([
      {
        tipo,
        pedido_id,
        payload: body,
      },
    ]);

    const cliente = extrairCliente(dados);
    const status = extrairStatus(dados);
    const total = extrairValor(dados);

    const data_pedido =
      dados?.data ||
      dados?.data_pedido ||
      dados?.created_at ||
      new Date().toISOString();

    const telefone =
      dados?.cliente?.telefone ||
      dados?.telefone ||
      dados?.celular ||
      null;

    const { error } = await supabase.from("wbuy_pedidos").upsert(
      {
        pedido_id,
        cliente,
        status,
        total,
        data_pedido,
        telefone,
        payload: body,
      },
      {
        onConflict: "pedido_id",
      }
    );

    if (error) {
      console.error("❌ Erro ao salvar pedido:", error);
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({
      ok: true,
      pedido_id,
      cliente,
      status,
      total,
    });
  } catch (error) {
    console.error("💥 ERRO GERAL:", error);
    return res.status(500).json({
      ok: false,
      erro: error.message,
    });
  }
});

// =========================
// SINCRONIZAÇÃO API WBUY
// =========================
app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("🔄 Sincronizando pedidos Wbuy...");

    const url = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        ok: false,
        erro: "WBUY_API_URL ou WBUY_TOKEN não configurado no Render",
      });
    }

    const tentativas = [
      {
        nome: "Authorization Bearer",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      {
        nome: "token minúsculo",
        headers: {
          "Content-Type": "application/json",
          token: token,
        },
      },
      {
        nome: "Token maiúsculo",
        headers: {
          "Content-Type": "application/json",
          Token: token,
        },
      },
    ];

    for (const tentativa of tentativas) {
      console.log(`🔐 Testando: ${tentativa.nome}`);

   const response = await fetch(process.env.WBUY_API_URL, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'token': process.env.WBUY_TOKEN
  }
});

      const json = await response.json();

      console.log(
        `📦 Resposta ${tentativa.nome}:`,
        JSON.stringify(json, null, 2)
      );

      if (
        response.ok &&
        (json?.responseCode == 200 ||
          json?.responseCode == "200" ||
          json?.code == "010" ||
          json?.message === "success")
      ) {
        const pedidosBruto =
          json?.data?.pedidos ||
          json?.data?.orders ||
          json?.data ||
          json?.pedidos ||
          json?.orders ||
          json?.response?.data ||
          json?.response ||
          [];

        const pedidos = Array.isArray(pedidosBruto)
          ? pedidosBruto
          : Object.values(pedidosBruto || {});

        let totalSincronizados = 0;

        for (const p of pedidos) {
          const pedido_id =
            p?.id?.toString() ||
            p?.pedido_id?.toString() ||
            p?.codigo?.toString();

          if (!pedido_id) continue;

          const cliente = extrairCliente(p);
          const status = extrairStatus(p);
          const total = extrairValor(p);

          const data_pedido =
            p?.data ||
            p?.data_pedido ||
            p?.created_at ||
            new Date().toISOString();

          const telefone =
            p?.cliente?.telefone ||
            p?.telefone ||
            p?.celular ||
            null;

          const { error } = await supabase.from("wbuy_pedidos").upsert(
            {
              pedido_id,
              cliente,
              status,
              total,
              data_pedido,
              telefone,
              payload: p,
            },
            {
              onConflict: "pedido_id",
            }
          );

          if (!error) totalSincronizados++;
          else console.error("❌ Erro ao salvar pedido sync:", error);
        }

        return res.json({
          ok: true,
          autenticacao_usada: tentativa.nome,
          total: totalSincronizados,
        });
      }
    }

    return res.status(403).json({
      ok: false,
      erro: "Nenhum formato de autenticação funcionou ou a API retornou sem sucesso.",
    });
  } catch (err) {
    console.error("💥 ERRO SYNC:", err);
    return res.status(500).json({
      ok: false,
      erro: err.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
