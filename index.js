const dados = data.dados || data;

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
