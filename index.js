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
  res.send("Servidor Wbuy rodando");
});

function isObjeto(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor);
}

function extrairDados(body) {
  if (isObjeto(body?.dados)) return body.dados;
  if (isObjeto(body?.payload)) return body.payload;
  if (isObjeto(body?.pedido)) return body.pedido;
  if (isObjeto(body?.order)) return body.order;
  if (isObjeto(body?.data)) return body.data;
  return body || {};
}

function extrairPedidoId(dados) {
  return String(
    dados?.pedido_id ||
    dados?.pedidoId ||
    dados?.id_pedido ||
    dados?.order_id ||
    dados?.id_order ||
    dados?.codigo ||
    dados?.numero ||
    dados?.id ||
    dados?.pedido?.id ||
    dados?.pedido?.codigo ||
    ""
  );
}

function extrairCliente(dados) {
  return (
    dados?.cliente?.nome ||
    dados?.cliente?.name ||
    dados?.cliente_nome ||
    dados?.customer?.name ||
    dados?.customer_name ||
    dados?.nome_cliente ||
    dados?.cliente ||
    dados?.nome ||
    "Cliente não informado"
  );
}

function extrairStatus(dados) {
  return (
    dados?.status_nome ||
    dados?.status_name ||
    dados?.status_descricao ||
    dados?.status_description ||
    dados?.situacao_nome ||
    dados?.situacao ||
    dados?.status?.nome ||
    dados?.status?.name ||
    dados?.status ||
    "Status não informado"
  );
}

function numeroBR(valor) {
  if (valor === undefined || valor === null || valor === "") return 0;
  if (typeof valor === "number") return valor;

  let texto = String(valor).trim();
  texto = texto.replace("R$", "").replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!texto) return 0;

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");

  if (temVirgula) {
    return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  if (temPonto) {
    return Number(texto) || 0;
  }

  return Number(texto) || 0;
}

function primeiroValorPositivo(...valores) {
  for (const valor of valores) {
    const numero = numeroBR(valor);
    if (numero > 0) return numero;
  }
  return 0;
}

function listaItens(dados) {
  const candidatos = [
    dados?.itens,
    dados?.items,
    dados?.produtos,
    dados?.products,
    dados?.pedido?.itens,
    dados?.pedido?.items,
    dados?.pedido?.produtos,
    dados?.cart?.items,
    dados?.carrinho?.itens
  ];

  for (const item of candidatos) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function calcularTotalItens(dados) {
  const itens = listaItens(dados);

  return itens.reduce((soma, item) => {
    const qtd = primeiroValorPositivo(
      item?.qtd,
      item?.qtde,
      item?.quantidade,
      item?.quantity,
      1
    ) || 1;

    const subtotalItem = primeiroValorPositivo(
      item?.total,
      item?.subtotal,
      item?.valor_total,
      item?.preco_total,
      item?.total_item,
      item?.valor_final
    );

    if (subtotalItem > 0) return soma + subtotalItem;

    const unitario = primeiroValorPositivo(
      item?.valor_unitario,
      item?.preco_unitario,
      item?.valor,
      item?.preco,
      item?.preco_venda,
      item?.price,
      item?.unit_price
    );

    return soma + unitario * qtd;
  }, 0);
}

function extrairValor(dados) {
  // Prioriza campos de total do PEDIDO. Isso evita pegar preço unitário de item como se fosse total.
  const totalDireto = primeiroValorPositivo(
    dados?.valor_total,
    dados?.total_itens,
    dados?.total_pedido,
    dados?.valor_pedido,
    dados?.valor_final,
    dados?.total_final,
    dados?.total_geral,
    dados?.vlr_total,
    dados?.subtotal,
    dados?.sub_total,
    dados?.total_produtos,
    dados?.valor_produtos,
    dados?.frete?.total,
    dados?.pagamento?.valor,
    dados?.pagamento?.total,
    dados?.payment?.value,
    dados?.payment?.total,
    dados?.pedido?.valor_total,
    dados?.pedido?.total_itens,
    dados?.pedido?.total,
    dados?.totais?.valor_total,
    dados?.totais?.total,
    dados?.totals?.total,
    dados?.totals?.grand_total
  );

  if (totalDireto > 0) return totalDireto;

  const totalItens = calcularTotalItens(dados);
  if (totalItens > 0) return totalItens;

  console.log("Pedido sem valor identificado:", {
    pedido_id: extrairPedidoId(dados),
    chaves: Object.keys(dados || {}),
    total: dados?.total,
    valor: dados?.valor,
    valor_total: dados?.valor_total,
    total_itens: dados?.total_itens,
    itens: listaItens(dados).length
  });

  return 0;
}

function extrairTelefone(dados) {
  return (
    dados?.telefone ||
    dados?.celular ||
    dados?.fone ||
    dados?.cliente?.telefone ||
    dados?.cliente?.celular ||
    dados?.cliente?.fone ||
    dados?.customer?.phone ||
    dados?.phone ||
    "-"
  );
}

function extrairData(dados) {
  return (
    dados?.data_pedido ||
    dados?.pedido_data ||
    dados?.created_at ||
    dados?.data_criacao ||
    dados?.date_created ||
    dados?.date ||
    dados?.data ||
    new Date().toISOString()
  );
}

function normalizarListaPedidos(json) {
  const candidatos = [
    json?.response?.data,
    json?.data?.data,
    json?.dados?.data,
    json?.result?.data,
    json?.response?.orders,
    json?.data?.orders,
    json?.dados?.orders,
    json?.data,
    json?.dados,
    json?.orders,
    json?.pedidos,
    json?.result,
    json?.response,
    json
  ];

  for (const item of candidatos) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function montarUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  });

  return url.toString();
}

function cabecalhosWbuy(token) {
  const tokenLimpo = String(token || "").replace(/^Bearer\s+/i, "").trim();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenLimpo}`
  };
}

async function buscarPedidosWbuy(url, token) {
  const response = await fetch(url, {
    method: "GET",
    headers: cabecalhosWbuy(token)
  });

  const texto = await response.text();
  let json;

  try {
    json = JSON.parse(texto);
  } catch (erro) {
    json = { raw: texto };
  }

  return {
    statusHttp: response.status,
    okHttp: response.ok,
    json,
    pedidos: normalizarListaPedidos(json)
  };
}

async function salvarPedido(pedido) {
  const dados = extrairDados(pedido);
  const pedido_id = extrairPedidoId(dados);

  if (!pedido_id) return false;

  const { error } = await supabase.from("wbuy_pedidos").upsert(
    {
      pedido_id,
      cliente: extrairCliente(dados),
      status: extrairStatus(dados),
      total: primeiroValorPositivo(
  dados?.total,
  dados?.subtotal,
  dados?.total_sem_desconto,
  dados?.valor_total,
  dados?.total_itens,
  calcularTotalItens(dados)
),
      telefone: extrairTelefone(dados),
      data_pedido: extrairData(dados),
      payload: dados
    },
    {
      onConflict: "pedido_id"
    }
  );

  if (error) {
    console.error("Erro ao salvar pedido no Supabase:", pedido_id, error);
    throw error;
  }

  return true;
}

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = extrairDados(body);
    const pedido_id = extrairPedidoId(dados);

    if (!pedido_id) {
      return res.status(200).json({ ok: true, ignored: true, motivo: "Sem pedido_id" });
    }

    await supabase.from("wbuy_eventos").insert({
      tipo: body?.tipo || body?.type || "wbuy_webhook",
      pedido_id,
      payload: body
    });

    await salvarPedido(dados);

    res.json({ ok: true, pedido_id });
  } catch (erro) {
    console.error("Erro webhook:", erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

app.get("/debug/wbuy", async (req, res) => {
  try {
    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ ok: false, erro: "WBUY_API_URL ou WBUY_TOKEN não configurado" });
    }

    const url = montarUrl(baseUrl, { limit: Number(req.query.limit || 100) });
    const resultado = await buscarPedidosWbuy(url, token);

    res.json({
      ok: resultado.okHttp,
      url,
      statusHttp: resultado.statusHttp,
      quantidade: resultado.pedidos.length,
      chavesResposta: resultado.json && typeof resultado.json === "object" ? Object.keys(resultado.json) : [],
      amostra: resultado.pedidos[0] || null,
      aviso: resultado.statusHttp === 401 ? "Token Wbuy inválido, expirado ou sem permissão" : undefined
    });
  } catch (erro) {
    console.error("Erro debug Wbuy:", erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

app.get("/debug/valores", async (req, res) => {
  try {
    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ ok: false, erro: "WBUY_API_URL ou WBUY_TOKEN não configurado" });
    }

    const url = montarUrl(baseUrl, { limit: Number(req.query.limit || 10) });
    const resultado = await buscarPedidosWbuy(url, token);

    const diagnostico = resultado.pedidos.slice(0, 10).map((pedido) => {
      const dados = extrairDados(pedido);
      return {
        pedido_id: extrairPedidoId(dados),
        cliente: extrairCliente(dados),
        valor_calculado: extrairValor(dados),
        candidatos_total: {
          valor_total: dados?.valor_total,
          total_itens: dados?.total_itens,
          total_pedido: dados?.total_pedido,
          valor_pedido: dados?.valor_pedido,
          total: dados?.total,
          valor: dados?.valor,
          subtotal: dados?.subtotal,
          total_produtos: dados?.total_produtos
        },
        primeiro_item: listaItens(dados)[0] || null
      };
    });

    res.json({ ok: resultado.okHttp, statusHttp: resultado.statusHttp, diagnostico });
  } catch (erro) {
    console.error("Erro debug valores:", erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("Iniciando sincronização Wbuy estável");

    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ ok: false, erro: "WBUY_API_URL ou WBUY_TOKEN não configurado" });
    }

    const limite = Number(req.query.limit || 100);
    const url = montarUrl(baseUrl, { limit: limite });

    console.log("Buscando:", url);

    const resultado = await buscarPedidosWbuy(url, token);
    const pedidos = resultado.pedidos;

    let totalSalvos = 0;

    if (resultado.okHttp && Array.isArray(pedidos)) {
      for (const pedido of pedidos) {
        const salvo = await salvarPedido(pedido);
        if (salvo) totalSalvos++;
      }
    }

    res.json({
      ok: resultado.okHttp,
      statusHttp: resultado.statusHttp,
      total_lidos: pedidos.length,
      total_salvos: totalSalvos,
      url,
      aviso: resultado.statusHttp === 401 ? "Token Wbuy inválido, expirado ou sem permissão" : undefined
    });
  } catch (erro) {
    console.error("Erro sync:", erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
