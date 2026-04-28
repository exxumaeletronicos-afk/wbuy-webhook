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
    dados?.status ||
    "Status não informado"
  );
}

function extrairValor(dados) {
  const valor =
    dados?.valor_total ||
    dados?.total ||
    dados?.valor ||
    dados?.valor_pedido ||
    dados?.pedido_total ||
    dados?.total_pedido ||
    dados?.pagamento?.valor ||
    dados?.pagamento?.total ||
    0;

  return Number(
    String(valor)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  ) || 0;
}

function extrairTelefone(dados) {
  return (
    dados?.telefone ||
    dados?.celular ||
    dados?.cliente?.telefone ||
    dados?.cliente?.celular ||
    dados?.customer?.phone ||
    dados?.phone ||
    ""
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
    json,
    json?.data,
    json?.dados,
    json?.orders,
    json?.pedidos,
    json?.result,
    json?.response,
    json?.retorno,
    json?.data?.data,
    json?.data?.dados,
    json?.data?.orders,
    json?.data?.pedidos,
    json?.dados?.data,
    json?.dados?.orders,
    json?.response?.data,
    json?.response?.orders,
    json?.result?.data,
    json?.result?.orders
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

function cabecalhosWbuy(token, modo = "bearer") {
  const headers = {
    "Content-Type": "application/json"
  };

  if (modo === "bearer") headers.Authorization = `Bearer ${token}`;
  if (modo === "token") headers.token = token;
  if (modo === "Token") headers.Token = token;
  if (modo === "authorization_raw") headers.Authorization = token;

  return headers;
}

async function buscarPedidosWbuy(url, token, modoAuth) {
  const response = await fetch(url, {
    method: "GET",
    headers: cabecalhosWbuy(token, modoAuth)
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

  const dataPedido = extrairData(dados);

  await supabase.from("wbuy_pedidos").upsert(
    {
      pedido_id,
      cliente: extrairCliente(dados),
      status: extrairStatus(dados),
      total: extrairValor(dados),
      telefone: extrairTelefone(dados),
      data_pedido: dataPedido,
      payload: dados
    },
    {
      onConflict: "pedido_id"
    }
  );

  return true;
}

app.post("/webhook/wbuy", async (req, res) => {
  try {
    const body = req.body;
    const dados = extrairDados(body);
    const pedido_id = extrairPedidoId(dados);

    if (!pedido_id) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        motivo: "Sem pedido_id"
      });
    }

    await supabase.from("wbuy_eventos").insert({
      tipo: body?.tipo || body?.type || "wbuy_webhook",
      pedido_id,
      payload: body
    });

    await salvarPedido(dados);

    res.json({
      ok: true,
      pedido_id
    });
  } catch (erro) {
    console.error("Erro webhook:", erro);
    res.status(500).json({
      ok: false,
      erro: erro.message
    });
  }
});

app.get("/debug/wbuy", async (req, res) => {
  try {
    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({
        ok: false,
        erro: "WBUY_API_URL ou WBUY_TOKEN não configurado"
      });
    }

    const testes = [
      { nome: "sem_paginacao", params: { limit: 100 } },
      { nome: "page", params: { limit: 100, page: 1 } },
      { nome: "pagina", params: { limit: 100, pagina: 1 } },
      { nome: "offset", params: { limit: 100, offset: 0 } },
      { nome: "data_inicio", params: { limit: 100, data_inicio: "2026-01-06" } },
      { nome: "dt_ini", params: { limit: 100, dt_ini: "2026-01-06" } },
      { nome: "date_start", params: { limit: 100, date_start: "2026-01-06" } }
    ];

    const resultados = [];

    for (const teste of testes) {
      const url = montarUrl(baseUrl, teste.params);
      const resultado = await buscarPedidosWbuy(url, token, "bearer");

      resultados.push({
        teste: teste.nome,
        url,
        statusHttp: resultado.statusHttp,
        quantidade: resultado.pedidos.length,
        chavesResposta: resultado.json && typeof resultado.json === "object" ? Object.keys(resultado.json) : [],
        amostra: resultado.pedidos[0] || null,
        respostaResumo: resultado.pedidos.length ? undefined : resultado.json
      });
    }

    res.json({ ok: true, resultados });
  } catch (erro) {
    console.error("Erro debug Wbuy:", erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

app.get("/sync/pedidos", async (req, res) => {
  try {
    console.log("Iniciando sincronização completa Wbuy");

    const baseUrl = process.env.WBUY_API_URL;
    const token = process.env.WBUY_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({
        ok: false,
        erro: "WBUY_API_URL ou WBUY_TOKEN não configurado"
      });
    }

    const dataInicial = req.query.data_inicio || "2026-01-06";
    const limite = Number(req.query.limit || 100);
    const maxPaginas = Number(req.query.max_paginas || 80);

    const estrategias = [
  {
    nome: "data_intervalo",
    montarParams: () => ({
      data_inicio: dataInicial,
      data_fim: new Date().toISOString().split("T")[0],
      limit: 100
    }),
    unica: true
  }
];
    let estrategiaUsada = null;
    let totalLidos = 0;
    let totalSalvos = 0;
    const idsProcessados = new Set();
    const logs = [];

    for (const estrategia of estrategias) {
      let pagina = 1;
      let encontrouNestaEstrategia = false;

      while (pagina <= maxPaginas) {
        const url = montarUrl(baseUrl, estrategia.montarParams(pagina));
        console.log(`[${estrategia.nome}] Buscando página ${pagina}: ${url}`);

        const resultado = await buscarPedidosWbuy(url, token, "bearer");
        const pedidos = resultado.pedidos;

        console.log(`[${estrategia.nome}] Página ${pagina}: ${pedidos.length} pedidos`);

        logs.push({
          estrategia: estrategia.nome,
          pagina,
          statusHttp: resultado.statusHttp,
          quantidade: pedidos.length
        });

        if (!resultado.okHttp) {
          console.log(`[${estrategia.nome}] HTTP ${resultado.statusHttp}`);
          break;
        }

        if (!Array.isArray(pedidos) || pedidos.length === 0) {
          break;
        }

        encontrouNestaEstrategia = true;
        estrategiaUsada = estrategia.nome;

        let novosNestaPagina = 0;

        for (const pedido of pedidos) {
          const dados = extrairDados(pedido);
          const pedido_id = extrairPedidoId(dados);

          if (!pedido_id) continue;
          if (idsProcessados.has(pedido_id)) continue;

          idsProcessados.add(pedido_id);
          novosNestaPagina++;
          totalLidos++;

          const dataPedido = extrairData(dados);

          if (dataPedido && new Date(dataPedido) < new Date(dataInicial)) {
            continue;
          }

          const salvo = await salvarPedido(dados);
          if (salvo) totalSalvos++;
        }

        if (estrategia.unica || pedidos.length < limite || novosNestaPagina === 0) {
          break;
        }

        pagina++;
      }

      if (encontrouNestaEstrategia) break;
    }

    res.json({
      ok: true,
      estrategia_usada: estrategiaUsada,
      total_lidos: totalLidos,
      total_salvos: totalSalvos,
      logs
    });
  } catch (erro) {
    console.error("Erro sync:", erro);
    res.status(500).json({
      ok: false,
      erro: erro.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
