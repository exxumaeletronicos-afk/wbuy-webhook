const express = require("express");
const app = express();

app.use(express.json());

app.post("/webhook/wbuy", (req, res) => {
  console.log("Webhook recebido:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ ok: true });
});

app.get("/", (req, res) => {
  res.send("Webhook online 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
