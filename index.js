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

function extrairStatus(dados) {
  return (
    dados?.status_nome ||
    dados?.situacao_nome ||
    dados?.status?.nome ||
    (typeof dados?.status === "string" ? dados.status : null) ||
    "Status não informado"
  );
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
    dados?.situacao ||
    dados?.situacao_nome ||
    "Status não informado"
  );
}

function extrairValor(dados) {
  const bruto =
    dados?.valor_total ||
    dados?.total ||
    dados?.valor ||
    dados?.pagamento?.valor_total ||
    0;

  return Number(
    String(bruto)
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = extrairDados(body);

    console.log("📦 WEBHOOK WBUY RECEBIDO");
    console.log("CHAVES BODY:", Object.keys(body || {}));
    console.log("CHAVES DADOS:", Object.keys(dados || {}));
    console.log("BODY COMPLETO:", JSON.stringify(body, null, 2));

    const tipo = body?.tipo || body?.type || body?.evento || "wbuy_webhook";
    const pedido_id = extrairPedidoId(body, dados);

    // 1. Salva evento bruto
    const { error: erroEvento } = await supabase.from("wbuy_eventos").insert([
      {
        tipo,
        pedido_id,
        payload: body,
      },
    ]);

    if (erroEvento) {
      console.error("❌ Erro ao salvar evento bruto:", erroEvento);
    } else {
      console.log("✅ Evento bruto salvo");
    }

    // 2. Salva pedido tratado básico
    const cliente = extrairCliente(dados);
    const status = extrairStatus(dados);
    const valor_total = extrairValor(dados);
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

    const { error: erroPedido } = await supabase.from("wbuy_pedidos").insert([
      {
        pedido_id,
        cliente,
        status,
        valor_total,
        data_pedido,
        telefone,
        payload: body,
      },
    ]);

    if (erroPedido) {
      console.error("❌ Erro ao salvar pedido tratado:", erroPedido);
    } else {
      console.log("✅ Pedido tratado salvo no Supabase");
    }

    return res.status(200).json({
      ok: true,
      pedido_id,
      cliente,
      status,
      valor_total,
    });
  } catch (error) {
    console.error("💥 ERRO GERAL:", error);
    return res.status(500).json({
      ok: false,
      erro: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("🔄 Buscando pedidos da Wbuy...");

    const response = await fetch(process.env.WBUY_API_URL);

    const json = await response.json();

    console.log("📦 RESPOSTA WBUY:", JSON.stringify(json, null, 2));

    const pedidos = json?.data || [];

    let total = 0;

    for (const p of pedidos) {
      const pedido_id = p?.id?.toString();
      if (!pedido_id) continue;

      const cliente =
        p?.cliente?.nome ||
        p?.cliente ||
        "Cliente não informado";

      const status =
        p?.status_nome ||
        p?.status ||
        "Status não informado";

      const valor_total = Number(p?.total || 0);

      await supabase.from("wbuy_pedidos").upsert(
        {
          pedido_id,
          cliente,
          status,
          valor_total,
          payload: p,
        },
        {
          onConflict: "pedido_id",
        }
      );

      total++;
    }

    console.log(`✅ ${total} pedidos sincronizados`);

    res.json({ ok: true, total });
  } catch (err) {
    console.error("💥 ERRO:", err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
