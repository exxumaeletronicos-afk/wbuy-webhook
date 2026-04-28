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
  res.send("Servidor Wbuy rodando");
});

function extrairDados(body) {
  return body?.dados || body?.data || body?.payload || body || {};
}

function extrairPedidoId(dados) {
  return String(
    dados?.pedido_id ||
    dados?.id ||
    dados?.codigo ||
    dados?.order_id ||
    ""
  );
}

function extrairCliente(dados) {
  return (
    dados?.cliente?.nome ||
    dados?.cliente ||
    dados?.customer_name ||
    dados?.nome ||
    "Cliente não informado"
  );
}

function extrairStatus(dados) {
  return (
    dados?.status_nome ||
    dados?.status_descricao ||
    dados?.status ||
    dados?.situacao ||
    "Status não informado"
  );
}

function extrairValor(dados) {
  const valor =
    dados?.valor_total ||
    dados?.total ||
    dados?.valor ||
    dados?.pedido_total ||
    dados?.pagamento?.valor ||
    dados?.pagamento?.total ||
    0;

  return Number(String(valor).replace("R$", "").replace(".", "").replace(",", ".")) || 0;
}

function extrairTelefone(dados) {
  return (
    dados?.telefone ||
    dados?.cliente?.telefone ||
    dados?.cliente?.celular ||
    dados?.phone ||
    ""
  );
}

function extrairData(dados) {
  return (
    dados?.data_pedido ||
    dados?.data ||
    dados?.created_at ||
    dados?.date ||
    new Date().toISOString()
  );
}

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = extrairDados(body);

    const pedido_id = extrairPedidoId(dados);

    if (!pedido_id) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        motivo: "Sem pedido_id"
      });
    }

    await supabase.from("wbuy_eventos").insert({
      tipo: body?.tipo || body?.type || "wbuy_webhook",
      pedido_id,
      payload: body
    });

    await supabase.from("wbuy_pedidos").upsert(
      {
        pedido_id,
        cliente: extrairCliente(dados),
        status: extrairStatus(dados),
        total: extrairValor(dados),
        telefone: extrairTelefone(dados),
        data_pedido: extrairData(dados),
        payload: dados
      },
      {
        onConflict: "pedido_id"
      }
    );

    res.json({
      ok: true,
      pedido_id
    });

  } catch (erro) {
    console.error("Erro webhook:", erro);
    res.status(500).json({
      ok: false,
      erro: erro.message
    });
  }
});

app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("Iniciando sincronização completa Wbuy");

    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({
        ok: false,
        erro: "WBUY_API_URL ou WBUY_TOKEN não configurado"
      });
    }

    let pagina = 1;
    let totalInseridos = 0;

    while (true) {
     const url = `${baseUrl}?limit=100&offset=${(pagina - 1) * 100}&data_inicio=2026-01-06&data_fim=2026-12-31`;
      console.log("Buscando:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const json = await response.json();

      const pedidos = Array.isArray(json)
        ? json
        : json?.data || json?.dados || json?.orders || [];

      console.log(`Página ${pagina}: ${pedidos.length} pedidos`);

      if (!Array.isArray(pedidos) || pedidos.length === 0) {
        break;
      }

      for (const pedido of pedidos) {
        const dados = extrairDados(pedido);
        const pedido_id = extrairPedidoId(dados);

        if (!pedido_id) continue;

        const dataPedido = extrairData(dados);

        if (dataPedido && new Date(dataPedido) < new Date("2026-01-06")) {
          continue;
        }

        await supabase.from("wbuy_pedidos").upsert(
          {
            pedido_id,
            cliente: extrairCliente(dados),
            status: extrairStatus(dados),
            total: extrairValor(dados),
            telefone: extrairTelefone(dados),
            data_pedido: dataPedido,
            payload: dados
          },
          {
            onConflict: "pedido_id"
          }
        );

        totalInseridos++;
      }

      if (pedidos.length < 100) {
        break;
      }

      pagina++;
    }

    res.json({
      ok: true,
      total: totalInseridos
    });

  } catch (erro) {
    console.error("Erro sync:", erro);
    res.status(500).json({
      ok: false,
      erro: erro.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
