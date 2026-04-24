const dados = data?.dados || data;

// 🧠 ID
const pedido_id = dados?.id || "SEM_ID";

// 👤 CLIENTE (suporta objeto OU texto)
const cliente = 
  dados?.cliente?.nome ||
  dados?.cliente ||
  "Cliente não informado";

// 📦 STATUS
const status =
  dados?.status_nome ||
  dados?.status ||
  dados?.situacao ||
  "Status não informado";

// 💰 VALOR
const valor_total = parseFloat(
  dados?.valor_total ||
  dados?.total ||
  dados?.valor ||
  0
);

// 📅 DATA
const data_pedido =
  dados?.data ||
  dados?.created_at ||
  new Date().toISOString();

// 📞 TELEFONE
const telefone =
  dados?.cliente?.telefone ||
  dados?.telefone ||
  null;
