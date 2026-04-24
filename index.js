const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.get("/", (req, res) => {
  res.send("Webhook online 🚀");
});

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const data = req.body;
    const dados = data?.dados || data || {};

    console.log("📦 Webhook recebido:");
    console.log(JSON.stringify(data, null, 2));

    const pedido_id =
      dados?.pedido_id?.toString() ||
      dados?.id?.toString() ||
      dados?.codigo?.toString() ||
      "SEM_ID";

    const cliente =
      dados?.cliente?.nome ||
      dados?.cliente_nome ||
      dados?.cliente ||
      dados?.nome ||
      "Cliente não informado";

    const status =
      dados?.status_nome ||
      dados?.status ||
      dados?.situacao ||
      "Status não informado";

    const valor_total = parseFloat(
      String(
        dados?.valor_total ||
        dados?.total ||
        dados?.valor ||
        dados?.pagamento?.valor_total ||
        0
      )
        .replace("R$", "")
        .replace(".", "")
        .replace(",", ".")
    );

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

    const { error } = await supabase.from("wbuy_pedidos").insert([
      {
        pedido_id,
        cliente,
        status,
        valor_total,
        data_pedido,
        telefone,
        payload: data,
      },
    ]);

    if (error) {
      console.error("❌ Erro ao salvar no Supabase:", error);
      return res.status(500).json({ ok: false, error });
    }

    console.log("✅ Pedido salvo no Supabase!");

    return res.status(200).json({
      ok: true,
      mensagem: "Webhook recebido e salvo com sucesso",
    });
  } catch (err) {
    console.error("💥 Erro geral:", err);
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
