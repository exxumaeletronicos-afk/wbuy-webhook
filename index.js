app.post("/webhook/wbuy", async (req, res) => {
  try {
    const data = req.body;

    console.log("Webhook recebido:", JSON.stringify(data, null, 2));

    // 🔥 GARANTE QUE dados SEMPRE EXISTE
    const dados = data?.dados || data || {};

    const pedido_id =
      dados.pedido_id?.toString() ||
      dados.id?.toString() ||
      "";

    const cliente =
      dados.cliente?.nome ||
      dados.nome ||
      dados.cliente_nome ||
      "Cliente não informado";

    const status =
      dados.status_nome ||
      dados.status ||
      dados.situacao ||
      "Status não informado";

    const valor_total = Number(
      dados.pagamento?.valor_total ||
      dados.valor_total ||
      dados.total ||
      dados.valor ||
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
        erro: resultado,
      });
    }

    console.log("Pedido salvo no Supabase:", resultado);

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    return res.status(500).json({
      ok: false,
      erro: error.message,
    });
  }
});
