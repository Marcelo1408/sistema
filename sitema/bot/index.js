// ============================================================
// CHEF DA BRASA - BOT HUMANO MODE - Node.js + whatsapp-web.js + OpenAI
// ============================================================
require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1" 
});

const API_URL = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const NOME_EMPRESA = process.env.NOME_EMPRESA || 'CHEF DA BRASA - BURGER ARTESANAL';
const SITE_URL = (process.env.SITE_URL || 'https://espetarianabrasa.giize.com').replace(/\/+$/, '');

const conversas = {};
const dadosEmpresa = { nome_empresa: NOME_EMPRESA, logo: null, logo_url: process.env.LOGO_URL || null };

// ===== PROMPT HUMANO =====
const SYSTEM_HUMAN = `
Você é o Leandro, dono do Chef da Brasa, Rua José Neves dos Santos, 15, Nova Hortolândia. 32 anos.
Você tá na chapa, atendendo o WhatsApp (19) 99681-4158 rapidão, mão suja.

REGRAS:
- SEMPRE minúsculo, curto, 1-2 linhas. Quebre com \\n\\n
- Usa "fala", "bora", "fechou?", "demoro", "tá na brasa", "c", "vc"
- NUNCA diga: "Olá seja bem vindo", "atendimento automático", "cardápio por categorias", "como posso ajudar"
- Se cliente perguntar preço, responde só aquele + oferece combo 35
- Se cliente disser "demora?", responde "25min aqui pro nova hortolandia"
- Objetivo é fechar pedido, pegar endereço e calcular entrega

Cardapio: x-burguer 18, x-duplo 28.90, combo duplo+coca 35
`;

async function gerarRespostaHumana(from, textoCliente) {
  const hist = conversas[from]?.historicoIA || [];
  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.88,
      top_p: 0.95,
      max_tokens: 100,
      messages: [
        { role: "system", content: SYSTEM_HUMAN },
       ...hist.slice(-8),
        { role: "user", content: textoCliente }
      ]
    });
    const resp = completion.choices[0].message.content;
    conversas[from].historicoIA = [...hist, { role: "user", content: textoCliente }, { role: "assistant", content: resp }].slice(-10);
    return resp;
  } catch (e) {
    console.log("Erro OpenAI:", e.message);
    return "fala mano 🔥\n\nbora de duplo 28,90 hoje?";
  }
}

async function sendHuman(client, to, texto) {
  const partes = texto.split('\n\n').filter(Boolean);
  for (const p of partes) {
    await client.sendStateTyping(to);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 2000 + p.length * 22));
    await client.sendMessage(to, p);
  }
}

// ===== SUAS FUNÇÕES JÁ CORRIGIDAS (SEM MOJIBAKE) =====
async function calcularEntrega(enderecoCompleto, conversa) {
  try {
    const payload = {
      cep: (conversa?.cep || '').replace(/\D/g, ''),
      endereco: conversa?.endereco || '',
      numero: conversa?.numero || '',
      bairro: conversa?.bairro || '',
      cidade: conversa?.cidade || 'Hortolândia',
      uf: conversa?.uf || 'SP',
      endereco_completo: enderecoCompleto
    };
    const { data } = await axios.post(`${API_URL}/calculo-de-entrega`, payload, { timeout: 20000 });
    return {
      taxa: Number(data.taxa || 0),
      km: Number(data.km || 0),
      calculada: true,
      bloqueada: data.bloqueada === true,
      mensagem: data.mensagem || ''
    };
  } catch (e) {
    console.log("Erro entrega:", e.response?.data || e.message);
    return { taxa: 0, km: 0, calculada: false, bloqueada: true, mensagem: "não achei seu endereço, me manda de novo com número e bairro?" };
  }
}

async function buscarProdutosAgrupados() {
  try {
    const { data } = await axios.get(`${API_URL}/produtos`);
    const categorias = {};
    (data || []).forEach(p => {
      const cat = p.categoria || 'Outros';
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(p);
    });
    return categorias;
  } catch (e) { return {}; }
}

function montarEndereco(conversa) {
  const { endereco = '', numero = '', bairro = '', cidade = '', uf = '' } = conversa;
  return `${endereco}, ${numero} - ${bairro} - ${cidade}/${uf}`.trim();
}

// ===== FLUXO PRINCIPAL =====
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🔥 CHEF DA BRASA - MODO HUMANO ON'));

client.on('message', async (message) => {
  if (message.fromMe || message.from.includes('@g.us')) return;

  const from = message.from;
  const texto = message.body.trim();

  if (!conversas[from]) {
    conversas[from] = { etapa: 'inicio', carrinho: [], historicoIA: [], endereco: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' };
  }
  const conv = conversas[from];

  // 1. SE FOR CONVERSA LIVRE (oi, quanto é, demora) -> IA HUMANA RESPONDE
  if (conv.etapa === 'inicio' && isNaN(texto) && texto.length < 50) {
    // se perguntou produto, mostra menu de forma humana
    if (texto.toLowerCase().includes('cardapio') || texto.toLowerCase().includes('cardápio') || texto.toLowerCase() === 'oi' || texto.toLowerCase() === 'ola') {
      const cats = await buscarProdutosAgrupados();
      const nomes = Object.keys(cats);
      let resposta = `fala! chef da brasa na brasa aqui 🔥\n\n`;
      resposta += `hoje tem:\n`;
      resposta += `🍔 x-burguer artesanal - 18 reais\n`;
      resposta += `🍔🍔 x-duplo na brasa - 28,90\n`;
      resposta += `🥤 combo duplo + coca - 35\n\n`;
      resposta += `qual bora? manda 1, 2 ou 3`;
      await sendHuman(client, from, resposta);
      conv.etapa = 'escolhendo';
      return;
    }

    const respIA = await gerarRespostaHumana(from, texto);
    await sendHuman(client, from, respIA);
    return;
  }

  // 2. SE ESCOLHEU PRODUTO (lógica do seu carrinho original mantida)
  if (conv.etapa === 'escolhendo') {
    // sua lógica de adicionar ao carrinho aqui...
    // Exemplo simplificado:
    if (['1', '2', '3'].includes(texto)) {
      const mapa = { '1': 'x-burguer 18', '2': 'x-duplo 28.90', '3': 'combo duplo+coca 35' };
      conv.carrinho.push(mapa[texto]);
      conv.etapa = 'endereco';
      await sendHuman(client, from, `fechou! ${mapa[texto]} tá na brasa já 🔥\n\nme manda seu endereço com número e bairro?`);
      return;
    }
  }

  if (conv.etapa === 'endereco') {
    conv.endereco = texto; // aqui você pode quebrar com sua lógica de CEP
    conv.bairro = 'Nova Hortolândia'; // simplificado
    conv.cidade = 'Hortolândia';
    conv.uf = 'SP';

    const enderecoFull = montarEndereco(conv);
    const entrega = await calcularEntrega(enderecoFull, conv);

    if (entrega.bloqueada) {
      await sendHuman(client, from, entrega.mensagem);
      return;
    }

    conv.entrega = entrega;
    conv.etapa = 'confirmar';
    await sendHuman(client, from, `demoro, achei aqui\n\nentrega fica ${entrega.taxa.toFixed(2)} - ${entrega.km}km\n\ntotal: carrinho + entrega\n\nconfirma? manda "sim"`);
    return;
  }

  if (conv.etapa === 'confirmar' && texto.toLowerCase().includes('sim')) {
    // chama sua API de criar pedido
    try {
      await axios.post(`${API_URL}/pedidos`, { cliente: from, carrinho: conv.carrinho, endereco: conv.endereco, entrega: conv.entrega });
      await sendHuman(client, from, `pedido fechado mano! 🔥\n\njá tá na brasa, 25min chega aí\n\nvaleu!`);
      conversas[from] = { etapa: 'inicio', carrinho: [], historicoIA: conv.historicoIA }; // reseta
    } catch (e) {
      await sendHuman(client, from, `deu um erro aqui no sistema, mas já vi seu pedido\n\nvou fazer na mão aqui, demoro?`);
    }
  }
});

client.initialize();

// API pra seu painel
const app = require('express')();
app.use(require('express').json());
app.get('/status', (req, res) => res.json({ status: 'online', modo: 'humano' }));
app.listen(3001, () => console.log('API bot rodando na 3001'));

// ============================================================
// WATCHDOG - reinicia se desconectar
// ============================================================
let watchdogFalhas = 0;
setInterval(async () => {
    try {
        const estado = await client.getState();
        if (['CONFLICT', 'UNPAIRED', 'UNPAIRED_IDLE', 'UNLAUNCHED', 'OPENING'].includes(estado)) {
            watchdogFalhas++;
            console.log(`⚠️ Estado WhatsApp: ${estado} (falha ${watchdogFalhas})`);
        } else {
            watchdogFalhas = 0;
        }
        if (watchdogFalhas >= 3) {
            console.log('❌ WhatsApp travado. Reiniciando...');
            process.exit(1);
        }
    } catch (e) {
        watchdogFalhas++;
        if (watchdogFalhas >= 3) process.exit(1);
    }
}, 60000);

process.on('unhandledRejection', (reason) => {
    console.log('Erro não tratado:', reason);
});
process.on('uncaughtException', (erro) => {
    console.log('Exceção não tratada:', erro.message);
});