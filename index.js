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

// =========================
// SYNC PEDIDOS
// =========================
app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("🔄 Buscando pedidos da Wbuy...");

    const response = await fetch(process.env.WBUY_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "token": process.env.WBUY_TOKEN
      }
    });

    const json = await response.json();

    console.log("📦 RESPOSTA WBUY:", JSON.stringify(json, null, 2));

    const pedidos = json?.data || [];

    if (!Array.isArray(pedidos)) {
      return res.json({
        ok: false,
        erro: "Formato inesperado",
        resposta: json
      });
    }

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
          payload: p
        },
        {
          onConflict: "pedido_id"
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

// =========================
// WEBHOOK
// =========================
app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = body?.data || body;

    const pedido_id = dados?.id?.toString() || null;

    await supabase.from("wbuy_eventos").insert([
      {
        tipo: body?.tipo || "webhook",
        pedido_id,
        payload: body
      }
    ]);

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
