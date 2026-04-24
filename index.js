const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🚀 Webhook Wbuy
app.post('/webhook/wbuy', async (req, res) => {
  try {
    console.log("📦 Webhook recebido:");
    console.log(JSON.stringify(req.body, null, 2));

    const data = req.body;

    // 🔍 Mapeamento correto baseado no seu log
    const pedido_id = data?.dados?.pedido_id || "EMPTY";
    const cliente = data?.dados?.cliente?.nome || "Cliente não informado";
    const status = data?.dados?.status_nome || "Status não informado";
    const valor_total = parseFloat(data?.dados?.valor_total || 0);

    const payload = data;

    const { error } = await supabase
      .from('wbuy_pedidos')
      .insert([{
        pedido_id,
        cliente,
        status,
        valor_total,
        payload
      }]);

    if (error) {
      console.error("❌ Erro ao salvar:", error);
    } else {
      console.log("✅ Pedido salvo no Supabase!");
    }

    res.status(200).json({ ok: true });

  } catch (err) {
    console.error("💥 ERRO:", err);
    res.status(500).json({ error: "erro interno" });
  }
});

// 🚀 Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
