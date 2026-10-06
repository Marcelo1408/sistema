-- Estrutura da tabela `adicionais`
CREATE TABLE IF NOT EXISTS adicionais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL DEFAULT 0.00,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `admin`
CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL,
  senha TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `bairros`
CREATE TABLE IF NOT EXISTS bairros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  taxa REAL DEFAULT 0.00,
  tempo_entrega INTEGER DEFAULT 30,
  pedido_minimo REAL DEFAULT 0.00,
  entrega_disponivel INTEGER DEFAULT 1,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `categorias`
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ativo INTEGER DEFAULT 1
);

-- Estrutura da tabela `clientes`
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  telefone TEXT,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  complemento TEXT,
  cep TEXT,
  referencia TEXT,
  senha_hash TEXT,
  ultimo_login DATETIME,
  total_pedidos INTEGER DEFAULT 0,
  valor_gasto REAL DEFAULT 0.00,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `comandas`
CREATE TABLE IF NOT EXISTS comandas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_numero TEXT NOT NULL,
  nome_cliente TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  data_abertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_fechamento DATETIME,
  total REAL DEFAULT 0.00,
  pedido_id INTEGER,
  expediente_fechado INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `combos`
CREATE TABLE IF NOT EXISTS combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL DEFAULT 0.00,
  imagem TEXT,
  destaque INTEGER DEFAULT 0,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `combo_opcoes_escolha`
CREATE TABLE IF NOT EXISTS combo_opcoes_escolha (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id INTEGER NOT NULL,
  produto_id INTEGER NOT NULL,
  nome_opcao TEXT NOT NULL,
  quantidade_maxima INTEGER DEFAULT 1,
  obrigatorio INTEGER DEFAULT 1
);

-- Estrutura da tabela `configuracoes`
CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_empresa TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  chave_pix TEXT,
  taxa_entrega REAL DEFAULT 0.00,
  entrega_km_base REAL DEFAULT 3.00,
  entrega_valor_km_adicional REAL DEFAULT 2.00,
  entrega_taxa_fallback REAL DEFAULT 10.00,
  loja_lat TEXT,
  loja_lng TEXT,
  tempo_preparo INTEGER DEFAULT 30,
  horario_abertura TEXT,
  horario_fechamento TEXT,
  logo TEXT,
  cor_principal TEXT DEFAULT '#ff6b00',
  loja_aberta INTEGER DEFAULT 0,
  expediente_aberto_em DATETIME,
  expediente_fechado_em DATETIME
);

-- Estrutura da tabela `embalagens`
CREATE TABLE IF NOT EXISTS embalagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT DEFAULT 'un',
  estoque INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 10,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `entregadores`
CREATE TABLE IF NOT EXISTS entregadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT,
  veiculo TEXT,
  placa TEXT,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `financeiro`
CREATE TABLE IF NOT EXISTS financeiro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  data_movimento DATE NOT NULL,
  forma_pagamento TEXT,
  observacao TEXT,
  pedido_id INTEGER,
  automatico INTEGER DEFAULT 0,
  categoria TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `itens_pedido`
CREATE TABLE IF NOT EXISTS itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER,
  produto_id INTEGER,
  tipo_item TEXT DEFAULT 'produto',
  item_id INTEGER,
  nome_item TEXT,
  quantidade INTEGER,
  valor_unitario REAL,
  subtotal REAL
);

-- Estrutura da tabela `pedidos`
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER,
  total REAL,
  pagamento TEXT,
  observacao TEXT,
  status TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  taxa_entrega REAL DEFAULT 0.00,
  origem TEXT DEFAULT 'WHATSAPP',
  status_pagamento TEXT DEFAULT 'PENDENTE',
  id_pagamento TEXT
);

-- Estrutura da tabela `produtos`
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL,
  imagem TEXT,
  ativo INTEGER DEFAULT 1,
  destaque INTEGER DEFAULT 0,
  estoque INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  ordem INTEGER DEFAULT 0
);

-- Estrutura da tabela `promocoes`
CREATE TABLE IF NOT EXISTS promocoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  imagem TEXT,
  produto_id INTEGER,
  preco_promocional REAL DEFAULT 0.00,
  data_inicio DATE,
  data_fim DATE,
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estrutura da tabela `usuarios`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  usuario TEXT NOT NULL,
  senha TEXT NOT NULL,
  nivel TEXT DEFAULT 'GERENTE',
  ativo INTEGER DEFAULT 1,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  telefone TEXT,
  foto TEXT,
  ultimo_acesso DATETIME
);
-- Estrutura da tabela `wa_sessoes`
CREATE TABLE IF NOT EXISTS wa_sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone TEXT UNIQUE,
  estado TEXT DEFAULT 'CONVERSA',
  sacola TEXT DEFAULT '[]',
  tipo_pedido TEXT DEFAULT 'entrega',
  endereco TEXT DEFAULT '',
  pagamento TEXT DEFAULT '',
  pedido_id INTEGER,
  pix_payment_id TEXT,
  atualizado_em TEXT DEFAULT (datetime('now'))
);

-- Estrutura da tabela `wa_mensagens`
CREATE TABLE IF NOT EXISTS wa_mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone TEXT,
  papel TEXT,
  texto TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

