app.post("/webhook/wbuy", async (req, res) => {
  try {
    const data = req.body;

    console.log("📦 Webhook recebido:");
    console.log(JSON.stringify(data, null, 2));

    const dados = data?.dados || data;

    const pedido_id =
      dados?.pedido_id?.toString() ||
      dados?.id?.toString() ||
      "SEM_ID";

    const cliente =
      dados?.cliente?.nome ||
      dados?.cliente ||
      "Cliente não informado";

    const status =
      dados?.status ||
      dados?.status_nome ||
      "Status não informado";

    const valor_total = parseFloat(
      dados?.valor_total ||
      dados?.total ||
      0
    );

    const { error } = await supabase.from("wbuy_pedidos").insert([
      {
        pedido_id,
        cliente,
        status,
        valor_total,
        payload: data,
      },
    ]);

    if (error) {
      console.error("❌ Erro ao salvar:", error);
    } else {
      console.log("✅ Pedido salvo com sucesso!");
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("💥 Erro:", err);
    res.status(500).json({ erro: err.message });
  }
});
