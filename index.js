const express = require("express");
const app = express();

app.use(express.json({ limit: "10mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

app.get("/", (req, res) => {
  res.send("Webhook online 🚀");
});

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const data = req.body;
    const dados = data.dados || {};

const pedido_id =
  dados.pedido_id?.toString() ||
  dados.id?.toString() ||
  "";

const cliente =
  dados.cliente?.nome ||
  dados.cliente?.razao ||
  "Cliente não informado";

const status =
  dados.status_nome ||
  dados.status ||
  "Status não informado";

const valor_total = Number(
  dados.pagamento?.valor_total ||
  dados.valor_total ||
  0
);

    const resposta = await fetch(`${SUPABASE_URL}/rest/v1/wbuy_pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        pedido_id,
        cliente,
        status,
        valor_total,
        payload: data,
      }),
    });

    const resultado = await resposta.text();

    if (!resposta.ok) {
      console.error("Erro ao salvar no Supabase:", resultado);
      return res.status(500).json({
        ok: false,
        erro: "Erro ao salvar no Supabase",
        detalhe: resultado,
      });
    }

    console.log("Pedido salvo no Supabase:", resultado);

    return res.status(200).json({
      ok: true,
      mensagem: "Webhook recebido e salvo com sucesso",
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return res.status(500).json({
      ok: false,
      erro: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
