const pedido_id = data?.dados?.id || "EMPTY";

const cliente = data?.dados?.cliente?.nome 
  || data?.dados?.cliente 
  || "Cliente não informado";

const status = data?.dados?.status_nome 
  || data?.dados?.status 
  || "Status não informado";

const valor_total = parseFloat(
  data?.dados?.valor_total 
  || data?.dados?.valor 
  || 0
);

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
