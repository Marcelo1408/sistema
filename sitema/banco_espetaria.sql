-- phpMyAdmin SQL Dump
-- version 5.1.1deb5ubuntu1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Tempo de geração: 09-Ago-2026 às 23:55
-- Versão do servidor: 10.6.23-MariaDB-0ubuntu0.22.04.1
-- versão do PHP: 8.1.2-1ubuntu2.24

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `banco_espetaria`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `adicionais`
--

CREATE TABLE `adicionais` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `preco` decimal(10,2) DEFAULT 0.00,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `adicionais`
--

INSERT INTO `adicionais` (`id`, `nome`, `descricao`, `preco`, `ativo`, `criado_em`) VALUES
(1, 'Arroz ', '', '8.00', 1, '2026-07-09 00:16:27'),
(2, 'Farofa', '', '6.50', 1, '2026-07-09 00:17:17'),
(3, 'Vigente ', '', '6.50', 1, '2026-07-09 00:17:36'),
(4, 'Mandioca c/ Alho', '', '8.50', 1, '2026-07-09 00:18:15'),
(5, 'Mandioca ', '', '7.00', 1, '2026-07-09 00:18:55');

-- --------------------------------------------------------

--
-- Estrutura da tabela `admin`
--

CREATE TABLE `admin` (
  `id` int(11) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `admin`
--

INSERT INTO `admin` (`id`, `usuario`, `senha`, `criado_em`) VALUES
(1, 'admin', '241084', '2026-06-08 01:58:45');

-- --------------------------------------------------------

--
-- Estrutura da tabela `bairros`
--

CREATE TABLE `bairros` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `taxa` decimal(10,2) DEFAULT 0.00,
  `tempo_entrega` int(11) DEFAULT 30,
  `pedido_minimo` decimal(10,2) DEFAULT 0.00,
  `entrega_disponivel` tinyint(1) DEFAULT 1,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `categorias`
--

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `ativo` tinyint(4) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `categorias`
--

INSERT INTO `categorias` (`id`, `nome`, `ativo`) VALUES
(1, 'ESPETINHOS', 1),
(2, 'PROMOÇÕES', 1),
(3, 'COMBOS', 1),
(4, 'BEBIDAS', 1),
(5, 'JANTINHA', 1),
(6, 'ADICIONAIS', 1),
(7, 'PORÇÕES', 1),
(8, 'LANCHES', 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `clientes`
--

CREATE TABLE `clientes` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `endereco` text DEFAULT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(20) DEFAULT NULL,
  `referencia` varchar(255) DEFAULT NULL,
  `senha_hash` varchar(255) DEFAULT NULL,
  `ultimo_login` datetime DEFAULT NULL,
  `total_pedidos` int(11) DEFAULT 0,
  `valor_gasto` decimal(10,2) DEFAULT 0.00,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `clientes`
--

INSERT INTO `clientes` (`id`, `nome`, `telefone`, `endereco`, `numero`, `bairro`, `complemento`, `cep`, `referencia`, `senha_hash`, `ultimo_login`, `total_pedidos`, `valor_gasto`, `criado_em`) VALUES
(2, 'Patrícia Oliveira', '5519987414255', 'Rua Domingos Batista de Souza', NULL, NULL, NULL, NULL, '', NULL, NULL, 1, '52.50', '2026-07-31 22:17:31'),
(3, 'Marcos Ribeiro', '19999821740', 'Rua Primavera', NULL, NULL, NULL, NULL, 'Casa de esquina', NULL, NULL, 1, '50.00', '2026-07-31 23:46:12'),
(4, 'Kelly Cristina Barreto', '5519999242921', 'Rua José Neves dos Santos', NULL, NULL, NULL, NULL, 'Condominio doce lar', NULL, NULL, 1, '36.50', '2026-08-01 00:28:22'),
(5, 'Rayane silva', '19992229097', 'Rua Ivanir de Sousa', NULL, NULL, NULL, NULL, '', NULL, NULL, 1, '57.48', '2026-08-01 22:13:43'),
(9, 'Marcelo Pereira', '5519982412418', 'Rua José da Silva Galvão', NULL, NULL, NULL, NULL, '', NULL, NULL, 3, '301.42', '2026-08-06 04:01:21'),
(10, 'Regina', '19982412418', 'Rua José Neves dos Santos, 15 - Jardim Nova Hortolândia II - Hortolândia/SP - 13183623', NULL, NULL, NULL, NULL, '', NULL, NULL, 1, '34.00', '2026-08-08 21:23:17'),
(11, 'Gerson Lima', '19991550794', 'Rua Odette Vieira Santos', NULL, NULL, NULL, NULL, 'Portão branco', NULL, NULL, 1, '88.95', '2026-08-08 23:40:54'),
(12, 'Eva', '19999208034', 'Rua Rio Negro, 235 - Parque Orestes Ôngaro - Hortolândia/SP - 13183700', NULL, NULL, NULL, NULL, '', NULL, NULL, 1, '182.93', '2026-08-08 23:52:02'),
(13, 'Djalma', '19993766612', 'Endereco nao informado', NULL, NULL, NULL, NULL, '', NULL, NULL, 1, '48.99', '2026-08-09 00:58:49');

-- --------------------------------------------------------

--
-- Estrutura da tabela `comandas`
--

CREATE TABLE `comandas` (
  `id` int(11) NOT NULL,
  `mesa_numero` varchar(20) NOT NULL,
  `nome_cliente` varchar(100) DEFAULT NULL,
  `status` enum('aberta','fechada','paga') NOT NULL DEFAULT 'aberta',
  `data_abertura` datetime NOT NULL DEFAULT current_timestamp(),
  `data_fechamento` datetime DEFAULT NULL,
  `total` decimal(10,2) DEFAULT 0.00,
  `pedido_id` int(11) DEFAULT NULL,
  `expediente_fechado` tinyint(1) NOT NULL DEFAULT 0,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `comanda_itens`
--

CREATE TABLE `comanda_itens` (
  `id` int(11) NOT NULL,
  `comanda_id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `quantidade` int(11) NOT NULL DEFAULT 1,
  `preco_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `combos`
--

CREATE TABLE `combos` (
  `id` int(11) NOT NULL,
  `nome` varchar(150) NOT NULL,
  `descricao` text DEFAULT NULL,
  `preco` decimal(10,2) DEFAULT 0.00,
  `imagem` varchar(255) DEFAULT NULL,
  `destaque` tinyint(1) DEFAULT 0,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `combos`
--

INSERT INTO `combos` (`id`, `nome`, `descricao`, `preco`, `imagem`, `destaque`, `ativo`, `criado_em`) VALUES
(29, 'COMBO CASAL', '2 Espetinhos (Carne, Frango ou Linguiça), 2 Coca Cola 350ml, Farofa Gourmet, Vinagrete, Mandioca', '32.90', '1785276771_1.png', 0, 1, '2026-07-29 21:57:38'),
(30, 'COMBO ESPECIAL', '3 Espetos (Carne, Frango, Linguiça), 2 Coca Cola 350ml, Farofa Gourmet, Vinagrete, Mandioca', '49.50', '1785276798_2.png', 0, 1, '2026-07-29 21:57:38'),
(31, 'COMBO TO COM FOME', '4 Espetinhos (Carne, Frango, Linguiça, Coração), 2 Coca Cola, Farofa Gourmet, Vinagrete, Mandioca', '69.90', '1785277204_3.png', 0, 1, '2026-07-29 21:57:38'),
(32, 'JANTINHA SEM REFRIGERANTE', 'Espetinho (Carne, Frango ou Linguiça), Arroz, Farofa Gourmet, Vinagrete, Mandioca, Molhos', '22.50', '1785278225_sem_refri.png', 0, 1, '2026-07-29 21:57:38'),
(33, 'JANTINHA COM REFRIGERANTE', 'Espetinho (Carne, Frango ou Linguiça), Arroz, Farofa Gourmet, Vinagrete, Mandioca, Coca Cola 200ml, Molhos', '24.99', '1785278453_4.png', 0, 1, '2026-07-29 21:57:38');

-- --------------------------------------------------------

--
-- Estrutura da tabela `combo_opcoes_escolha`
--

CREATE TABLE `combo_opcoes_escolha` (
  `id` int(11) NOT NULL,
  `combo_id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `nome_opcao` varchar(100) NOT NULL,
  `quantidade_maxima` int(11) DEFAULT 1,
  `obrigatorio` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `combo_opcoes_escolha`
--

INSERT INTO `combo_opcoes_escolha` (`id`, `combo_id`, `produto_id`, `nome_opcao`, `quantidade_maxima`, `obrigatorio`) VALUES
(1, 29, 6, 'Carne', 2, 1),
(2, 29, 7, 'Frango', 2, 1),
(3, 29, 8, 'Linguiça', 2, 1),
(4, 30, 6, 'Carne', 3, 1),
(5, 30, 7, 'Frango', 3, 1),
(6, 30, 8, 'Linguiça', 3, 1),
(7, 31, 6, 'Carne', 4, 1),
(8, 31, 7, 'Frango', 4, 1),
(9, 31, 8, 'Linguiça', 4, 1),
(10, 31, 24, 'Coração', 4, 1),
(11, 32, 6, 'Carne', 1, 1),
(12, 32, 7, 'Frango', 1, 1),
(13, 32, 8, 'Linguiça', 1, 1),
(14, 33, 6, 'Carne', 1, 1),
(15, 33, 7, 'Frango', 1, 1),
(16, 33, 8, 'Linguiça', 1, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `combo_produtos`
--

CREATE TABLE `combo_produtos` (
  `id` int(11) NOT NULL,
  `combo_id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `quantidade` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `combo_produtos`
--

INSERT INTO `combo_produtos` (`id`, `combo_id`, `produto_id`, `quantidade`) VALUES
(1, 29, 9, 2),
(2, 29, 18, 1),
(3, 29, 20, 1),
(4, 29, 21, 1),
(5, 29, 19, 1),
(6, 30, 9, 2),
(7, 30, 20, 1),
(8, 30, 21, 1),
(9, 30, 19, 1),
(10, 31, 9, 2),
(11, 31, 20, 1),
(12, 31, 21, 1),
(13, 31, 19, 1),
(14, 32, 18, 1),
(15, 32, 20, 1),
(16, 32, 21, 1),
(17, 32, 19, 1),
(18, 33, 22, 1),
(19, 33, 18, 1),
(20, 33, 20, 1),
(21, 33, 21, 1),
(22, 33, 19, 1);

-- --------------------------------------------------------

--
-- Estrutura da tabela `configuracoes`
--

CREATE TABLE `configuracoes` (
  `id` int(11) NOT NULL,
  `nome_empresa` varchar(150) DEFAULT NULL,
  `telefone` varchar(30) DEFAULT NULL,
  `whatsapp` varchar(30) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `endereco` text DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(50) DEFAULT NULL,
  `cep` varchar(20) DEFAULT NULL,
  `chave_pix` varchar(255) DEFAULT NULL,
  `taxa_entrega` decimal(10,2) DEFAULT 0.00,
  `entrega_km_base` decimal(10,2) NOT NULL DEFAULT 3.00,
  `entrega_valor_km_adicional` decimal(10,2) NOT NULL DEFAULT 2.00,
  `entrega_taxa_fallback` decimal(10,2) NOT NULL DEFAULT 10.00,
  `loja_lat` varchar(50) DEFAULT NULL,
  `loja_lng` varchar(50) DEFAULT NULL,
  `tempo_preparo` int(11) DEFAULT 30,
  `horario_abertura` varchar(10) DEFAULT NULL,
  `horario_fechamento` varchar(10) DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `cor_principal` varchar(20) DEFAULT '#ff6b00',
  `loja_aberta` tinyint(1) NOT NULL DEFAULT 0,
  `expediente_aberto_em` datetime DEFAULT NULL,
  `expediente_fechado_em` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `configuracoes`
--

INSERT INTO `configuracoes` (`id`, `nome_empresa`, `telefone`, `whatsapp`, `email`, `endereco`, `cidade`, `estado`, `cep`, `chave_pix`, `taxa_entrega`, `entrega_km_base`, `entrega_valor_km_adicional`, `entrega_taxa_fallback`, `loja_lat`, `loja_lng`, `tempo_preparo`, `horario_abertura`, `horario_fechamento`, `logo`, `cor_principal`, `loja_aberta`, `expediente_aberto_em`, `expediente_fechado_em`) VALUES
(1, 'Espetaria', '', '', '', 'Rua José Neves dos Santos Número 15', 'Hortolândia', 'SP', '13183660', '19999797310', '0.00', '3.00', '2.50', '15.00', '-22.855405', '-47.208629', 30, '18:00', '00:00', 'logo_1783534222.png', '#ff6b00', 0, '2026-08-09 17:56:06', '2026-08-09 17:56:10');

-- --------------------------------------------------------

--
-- Estrutura da tabela `configuracoes_whatsapp`
--

CREATE TABLE `configuracoes_whatsapp` (
  `id` int(11) NOT NULL,
  `saudacao` text DEFAULT NULL,
  `mensagem_fechado` text DEFAULT NULL,
  `taxa_entrega` decimal(10,2) DEFAULT NULL,
  `pix` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `cupons`
--

CREATE TABLE `cupons` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `tipo` enum('PORCENTAGEM','VALOR') NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `valor_minimo` decimal(10,2) DEFAULT 0.00,
  `quantidade` int(11) DEFAULT 0,
  `usados` int(11) DEFAULT 0,
  `data_inicio` date DEFAULT NULL,
  `data_fim` date DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `cupons`
--

INSERT INTO `cupons` (`id`, `codigo`, `tipo`, `valor`, `valor_minimo`, `quantidade`, `usados`, `data_inicio`, `data_fim`, `ativo`, `criado_em`) VALUES
(1, 'INAUGURAÇÃO', 'PORCENTAGEM', '10.00', '50.00', 30, 0, '2026-07-31', '2026-07-08', 1, '2026-07-09 00:22:16');

-- --------------------------------------------------------

--
-- Estrutura da tabela `embalagem_movimentacoes`
--

CREATE TABLE `embalagem_movimentacoes` (
  `id` int(11) NOT NULL,
  `embalagem_id` int(11) NOT NULL,
  `tipo` enum('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  `quantidade` int(11) NOT NULL,
  `observacao` text DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `embalagens`
--

CREATE TABLE `embalagens` (
  `id` int(11) NOT NULL,
  `nome` varchar(120) NOT NULL,
  `descricao` text DEFAULT NULL,
  `unidade` varchar(30) DEFAULT 'un',
  `estoque` int(11) NOT NULL DEFAULT 0,
  `estoque_minimo` int(11) NOT NULL DEFAULT 10,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `entregadores`
--

CREATE TABLE `entregadores` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `telefone` varchar(30) DEFAULT NULL,
  `veiculo` varchar(50) DEFAULT NULL,
  `placa` varchar(20) DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `estoque_movimentacoes`
--

CREATE TABLE `estoque_movimentacoes` (
  `id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `tipo` enum('ENTRADA','SAIDA','AJUSTE') NOT NULL,
  `quantidade` int(11) NOT NULL,
  `observacao` text DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `estoque_movimentacoes`
--

INSERT INTO `estoque_movimentacoes` (`id`, `produto_id`, `tipo`, `quantidade`, `observacao`, `criado_em`) VALUES
(32, 29, 'SAIDA', 1, 'Venda automática - Pedido #1', '2026-07-31 22:01:05'),
(33, 32, 'SAIDA', 2, 'Venda automática - Pedido #2', '2026-07-31 22:17:31'),
(34, 32, 'SAIDA', 2, 'Venda automática - Pedido #3', '2026-07-31 23:46:12'),
(35, 6, 'SAIDA', 2, 'Venda automática - Pedido #4', '2026-08-01 00:28:22'),
(36, 24, 'SAIDA', 1, 'Venda automática - Pedido #4', '2026-08-01 00:28:22'),
(37, 33, 'SAIDA', 2, 'Venda automática - Pedido #5', '2026-08-01 22:13:43'),
(38, 6, 'SAIDA', 1, 'Venda automática - Pedido #7', '2026-08-05 17:19:29'),
(39, 6, 'SAIDA', 1, 'Venda automática - Pedido #8', '2026-08-05 17:28:20'),
(40, 6, 'SAIDA', 1, 'Venda automática - Pedido #9', '2026-08-05 17:34:32'),
(41, 6, 'SAIDA', 1, 'Venda automática - Pedido #10', '2026-08-05 17:37:08'),
(42, 6, 'SAIDA', 1, 'Venda automática - Pedido #11', '2026-08-05 17:47:24'),
(43, 33, 'SAIDA', 2, 'Venda automática - Pedido #12', '2026-08-05 17:47:52'),
(44, 19, 'SAIDA', 2, 'Venda automática - Pedido #12', '2026-08-05 17:47:52'),
(45, 6, 'SAIDA', 1, 'Venda automática - Pedido #13', '2026-08-05 19:05:13'),
(46, 18, 'SAIDA', 1, 'Venda automática - Pedido #13', '2026-08-05 19:05:13'),
(47, 20, 'SAIDA', 1, 'Venda automática - Pedido #13', '2026-08-05 19:05:13'),
(48, 24, 'SAIDA', 1, 'Venda automática - Pedido #13', '2026-08-05 19:05:13'),
(49, 7, 'SAIDA', 2, 'Venda automática - Pedido #13', '2026-08-05 19:05:13'),
(50, 22, 'SAIDA', 1, 'Venda automática - Pedido #14', '2026-08-05 20:02:10'),
(51, 22, 'SAIDA', 1, 'Venda automática - Pedido #15', '2026-08-05 20:13:50'),
(52, 30, 'SAIDA', 1, 'Venda automática - Pedido #16', '2026-08-05 20:23:08'),
(53, 22, 'SAIDA', 1, 'Venda automática - Pedido #17', '2026-08-05 20:29:42'),
(54, 9, 'SAIDA', 1, 'Venda automática - Pedido #18', '2026-08-05 20:32:07'),
(55, 22, 'SAIDA', 1, 'Venda automática - Pedido #19', '2026-08-05 20:35:52'),
(56, 22, 'SAIDA', 1, 'Venda automática - Pedido #20', '2026-08-05 21:07:05'),
(57, 6, 'SAIDA', 1, 'Venda automática - Pedido #21', '2026-08-05 22:51:42'),
(58, 29, 'SAIDA', 1, 'Venda automática - Pedido #22', '2026-08-05 22:57:40'),
(59, 6, 'SAIDA', 2, 'Venda automática - Pedido #23', '2026-08-06 04:01:21'),
(60, 6, 'SAIDA', 2, 'Venda automática - Pedido #24', '2026-08-08 01:34:14'),
(61, 24, 'SAIDA', 3, 'Venda automática - Pedido #24', '2026-08-08 01:34:14'),
(62, 34, 'SAIDA', 1, 'Venda automática - Pedido #24', '2026-08-08 01:34:14'),
(63, 32, 'SAIDA', 3, 'Venda automática - Pedido #24', '2026-08-08 01:34:14'),
(64, 17, 'SAIDA', 1, 'Venda automática - Pedido #24', '2026-08-08 01:34:14'),
(65, 32, 'SAIDA', 2, 'Venda automática - Pedido #25', '2026-08-08 01:38:41'),
(66, 17, 'SAIDA', 1, 'Venda automática - Pedido #25', '2026-08-08 01:38:41'),
(67, 6, 'SAIDA', 2, 'Venda automática - Pedido #25', '2026-08-08 01:38:41'),
(68, 34, 'SAIDA', 1, 'Venda automática - Pedido #25', '2026-08-08 01:38:41'),
(69, 35, 'SAIDA', 1, 'Venda automática - Pedido #25', '2026-08-08 01:38:41'),
(70, 6, 'SAIDA', 1, 'Venda automática - Pedido #26', '2026-08-08 21:23:17'),
(71, 24, 'SAIDA', 1, 'Venda automática - Pedido #26', '2026-08-08 21:23:17'),
(72, 7, 'SAIDA', 1, 'Venda automática - Pedido #26', '2026-08-08 21:23:17'),
(73, 6, 'SAIDA', 2, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(74, 17, 'SAIDA', 2, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(75, 8, 'SAIDA', 1, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(76, 18, 'SAIDA', 1, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(77, 19, 'SAIDA', 1, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(78, 21, 'SAIDA', 1, 'Venda automática - Pedido #27', '2026-08-08 23:40:54'),
(79, 6, 'SAIDA', 4, 'Venda automática - Pedido #28', '2026-08-08 23:52:02'),
(80, 7, 'SAIDA', 3, 'Venda automática - Pedido #28', '2026-08-08 23:52:02'),
(81, 24, 'SAIDA', 3, 'Venda automática - Pedido #28', '2026-08-08 23:52:02'),
(82, 8, 'SAIDA', 3, 'Venda automática - Pedido #28', '2026-08-08 23:52:02'),
(83, 34, 'SAIDA', 3, 'Venda automática - Pedido #28', '2026-08-08 23:52:02'),
(84, 12, 'SAIDA', 2, 'Venda automática - Pedido #29', '2026-08-09 00:58:49'),
(85, 6, 'SAIDA', 1, 'Venda automática - Pedido #29', '2026-08-09 00:58:49'),
(86, 25, 'SAIDA', 1, 'Venda automática - Pedido #29', '2026-08-09 00:58:49'),
(87, 34, 'SAIDA', 1, 'Venda automática - Pedido #29', '2026-08-09 00:58:49');

-- --------------------------------------------------------

--
-- Estrutura da tabela `financeiro`
--

CREATE TABLE `financeiro` (
  `id` int(11) NOT NULL,
  `tipo` enum('ENTRADA','SAIDA') NOT NULL,
  `descricao` varchar(255) NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `data_movimento` date NOT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  `observacao` text DEFAULT NULL,
  `pedido_id` int(11) DEFAULT NULL,
  `automatico` tinyint(1) NOT NULL DEFAULT 0,
  `categoria` varchar(50) DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `financeiro`
--

INSERT INTO `financeiro` (`id`, `tipo`, `descricao`, `valor`, `data_movimento`, `forma_pagamento`, `observacao`, `pedido_id`, `automatico`, `categoria`, `criado_em`) VALUES
(3, 'SAIDA', 'Compra - Miolo do Acem (4,500 kg)', '155.25', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(4, 'SAIDA', 'Compra - Carne Mioda (2,00 kg)', '59.54', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(5, 'SAIDA', 'Compra - Peito de Frango s/ osso (6,200 kg)', '99.14', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(6, 'SAIDA', 'Compra - Coração de Frango (2,700 kg)', '96.39', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(7, 'SAIDA', 'Compra - Cupim (2,700 kg)', '93.34', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(8, 'SAIDA', 'Compra - Gordura (2,200 kg)', '21.78', '2026-07-09', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-09 23:27:57'),
(12, 'SAIDA', 'Compra - Espetinho (200 un)', '16.00', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(13, 'SAIDA', 'Compra - Espetinho (300 un)', '29.67', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(14, 'SAIDA', 'Compra - Pote 200ml (48 un)', '18.80', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(15, 'SAIDA', 'Compra - Pode 100ml (200 un)', '11.80', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(16, 'SAIDA', 'Compra - Tampo 100ml (200 un)', '11.80', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(17, 'SAIDA', 'Compra - Canudo (100 un)', '4.99', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(18, 'SAIDA', 'Compra - Emb. Terminar de espetinho (100 un)', '59.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(19, 'SAIDA', 'Compra - Caldo de carne (1 kg)', '10.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(20, 'SAIDA', 'Compra - Creme de.cebola (1 kg)', '19.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(21, 'SAIDA', 'Compra - Bacon fatiado (1 kg)', '26.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(22, 'SAIDA', 'Compra - Bacon fatiado (1 kg)', '26.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(23, 'SAIDA', 'Compra - Saco de pedidos (100 un)', '51.90', '2026-07-12', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-12 06:09:48'),
(26, 'SAIDA', 'Compra - Alho triturador 400g (1 un)', '9.90', '2026-07-16', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-16 17:11:17'),
(27, 'SAIDA', 'Compra - Tempero completo 300g (1 un)', '6.95', '2026-07-16', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-16 17:11:17'),
(28, 'SAIDA', 'Compra - Sal (1 kg)', '2.69', '2026-07-16', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-16 17:11:17'),
(29, 'SAIDA', 'Compra - Vinagre 750ml (1 l)', '8.15', '2026-07-16', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-16 17:11:17'),
(38, 'SAIDA', 'Compra - Ling. Toscana panplon (4 kg)', '57.88', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 18:54:00'),
(39, 'SAIDA', 'Compra - Qj coalho (1 un)', '19.49', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 18:54:00'),
(40, 'SAIDA', 'Compra - Qj coalho (1 un)', '19.49', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 18:54:00'),
(41, 'SAIDA', 'Compra - Pão de alho c/Bacon (1 un)', '19.96', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 18:54:00'),
(42, 'SAIDA', 'Compra - Pão de alho tradicional (1 un)', '19.96', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(43, 'SAIDA', 'Compra - Coloral 500g (1 kg)', '7.69', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(44, 'SAIDA', 'Compra - Tempero completo ariaco (1 un)', '7.99', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(45, 'SAIDA', 'Compra - Vinagre toscano (1 un)', '5.58', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(46, 'SAIDA', 'Compra - Carvao (5 pct)', '54.95', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(47, 'SAIDA', 'Compra - Cerveja Original 350ml (2 pct)', '95.76', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(48, 'SAIDA', 'Compra - Coca cola 200ml (2 pct)', '40.56', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(49, 'SAIDA', 'Compra - Cerveja Skol 350ml (1 pct)', '55.62', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:09:03'),
(50, 'SAIDA', 'Compra - Cola cola 350ml (2 pct)', '81.39', '2026-07-23', 'PIX', '', NULL, 0, 'COMPRA', '2026-07-23 19:10:35'),
(64, 'ENTRADA', 'Venda automática - Pedido #1', '35.40', '2026-07-31', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 1, 1, 'VENDA', '2026-07-31 22:01:05'),
(65, 'ENTRADA', 'Venda automática - Pedido #2', '52.50', '2026-07-31', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 2, 1, 'VENDA', '2026-07-31 22:17:31'),
(66, 'ENTRADA', 'Venda automática - Pedido #3', '50.00', '2026-07-31', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 3, 1, 'VENDA', '2026-07-31 23:46:12'),
(67, 'ENTRADA', 'Venda automática - Pedido #4', '36.50', '2026-08-01', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 4, 1, 'VENDA', '2026-08-01 00:28:22'),
(68, 'ENTRADA', 'Venda automática - Pedido #5', '57.48', '2026-08-01', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 5, 1, 'VENDA', '2026-08-01 22:13:43'),
(86, 'ENTRADA', 'Venda automática - Pedido #24', '154.96', '2026-08-08', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 24, 1, 'VENDA', '2026-08-08 01:34:14'),
(87, 'ENTRADA', 'Venda automática - Pedido #25', '121.96', '2026-08-08', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 25, 1, 'VENDA', '2026-08-08 01:38:41'),
(88, 'ENTRADA', 'Venda automática - Pedido #26', '34.00', '2026-08-08', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 26, 1, 'VENDA', '2026-08-08 21:23:17'),
(89, 'SAIDA', 'Compra - Flaudinha (5,596 kg)', '223.78', '2026-08-08', 'PIX', '', NULL, 0, 'COMPRA', '2026-08-08 21:41:16'),
(90, 'ENTRADA', 'Venda automática - Pedido #27', '88.95', '2026-08-08', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 27, 1, 'VENDA', '2026-08-08 23:40:54'),
(91, 'ENTRADA', 'Venda automática - Pedido #28', '182.93', '2026-08-08', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 28, 1, 'VENDA', '2026-08-08 23:52:02'),
(92, 'ENTRADA', 'Venda automática - Pedido #29', '48.99', '2026-08-09', 'PIX', 'Entrada gerada automaticamente pelo pedido do WhatsApp.', 29, 1, 'VENDA', '2026-08-09 00:58:49');

-- --------------------------------------------------------

--
-- Estrutura da tabela `itens_pedido`
--

CREATE TABLE `itens_pedido` (
  `id` int(11) NOT NULL,
  `pedido_id` int(11) DEFAULT NULL,
  `produto_id` int(11) DEFAULT NULL,
  `tipo_item` varchar(30) NOT NULL DEFAULT 'produto',
  `item_id` int(11) DEFAULT NULL,
  `nome_item` varchar(255) DEFAULT NULL,
  `quantidade` int(11) DEFAULT NULL,
  `valor_unitario` decimal(10,2) DEFAULT NULL,
  `subtotal` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `itens_pedido`
--

INSERT INTO `itens_pedido` (`id`, `pedido_id`, `produto_id`, `tipo_item`, `item_id`, `nome_item`, `quantidade`, `valor_unitario`, `subtotal`) VALUES
(1, 1, 29, 'produto', 29, '1 - COMBO CASAL', 1, '32.90', '32.90'),
(2, 2, 32, 'produto', 32, 'JANTINHA SEM REFRIGERANTE', 2, '22.50', '45.00'),
(3, 3, 32, 'produto', 32, 'JANTINHA SEM REFRIGERANTE', 2, '22.50', '45.00'),
(4, 4, 6, 'produto', 6, 'ESPETINHO DE CARNE', 2, '11.00', '22.00'),
(5, 4, 24, 'produto', 24, 'ESPETINHO DE CORAÇÃO DE FRANGO', 1, '12.00', '12.00'),
(6, 5, 33, 'produto', 33, 'JANTINHA COM REFRIGERANTE', 2, '24.99', '49.98'),
(7, 7, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(8, 8, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(9, 9, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(10, 10, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(11, 11, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(12, 12, 33, 'produto', 33, 'JANTINHA COM REFRIGERANTE', 2, '24.99', '49.98'),
(13, 12, 19, 'produto', 19, 'MANDIOCA', 2, '6.50', '13.00'),
(14, 13, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(15, 13, 18, 'produto', 18, 'ARROZ', 1, '9.97', '9.97'),
(16, 13, 20, 'produto', 20, 'FAROFA GOURMET', 1, '8.00', '8.00'),
(17, 13, 24, 'produto', 24, 'ESPETINHO DE CORAÇÃO DE FRANGO', 1, '12.00', '12.00'),
(18, 13, 7, 'produto', 7, 'ESPETINHO DE FRANGO', 2, '11.00', '22.00'),
(19, 14, 22, 'produto', 22, 'COCA COLA 200ML', 1, '4.00', '4.00'),
(20, 15, 22, 'produto', 22, 'COCA COLA 200ML', 1, '4.00', '4.00'),
(21, 16, 30, 'produto', 30, '2 - COMBO ESPECIAL', 1, '49.50', '49.50'),
(22, 17, 22, 'produto', 22, 'COCA COLA 200ML', 1, '4.00', '4.00'),
(23, 18, 9, 'produto', 9, 'COCA COLA 350ML', 1, '6.90', '6.90'),
(24, 19, 22, 'produto', 22, 'COCA COLA 200ML', 1, '4.00', '4.00'),
(25, 20, 22, 'produto', 22, 'COCA COLA 200ML', 1, '4.00', '4.00'),
(26, 21, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(27, 22, 29, 'produto', 29, '1 - COMBO CASAL', 1, '32.90', '32.90'),
(28, 23, 6, 'produto', 6, 'ESPETINHO DE CARNE', 2, '11.00', '22.00'),
(29, 24, 6, 'produto', 6, 'ESPETINHO DE CARNE', 2, '11.00', '22.00'),
(30, 24, 24, 'produto', 24, 'ESPETINHO DE CORAÇÃO DE FRANGO', 3, '12.00', '36.00'),
(31, 24, 34, 'produto', 34, 'ESPETINHO DE QUEIJO COALHO', 1, '9.99', '9.99'),
(32, 24, 32, 'produto', 32, 'Marmitinha do chef 01', 3, '24.99', '74.97'),
(33, 24, 17, 'produto', 17, 'ESPETINHO DE CUPIM', 1, '12.00', '12.00'),
(34, 25, 32, 'produto', 32, 'Marmitinha do chef 01', 2, '24.99', '49.98'),
(35, 25, 17, 'produto', 17, 'ESPETINHO DE CUPIM', 1, '12.00', '12.00'),
(36, 25, 6, 'produto', 6, 'ESPETINHO DE CARNE', 2, '11.00', '22.00'),
(37, 25, 34, 'produto', 34, 'ESPETINHO DE QUEIJO COALHO', 1, '9.99', '9.99'),
(38, 25, 35, 'produto', 35, 'CHURRASCO NO PAO ( CONTRA-FILÉ)', 1, '20.00', '20.00'),
(39, 26, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(40, 26, 24, 'produto', 24, 'ESPETINHO DE CORAÇÃO DE FRANGO', 1, '12.00', '12.00'),
(41, 26, 7, 'produto', 7, 'ESPETINHO DE FRANGO', 1, '11.00', '11.00'),
(42, 27, 6, 'produto', 6, 'ESPETINHO DE CARNE', 2, '11.00', '22.00'),
(43, 27, 17, 'produto', 17, 'ESPETINHO DE CUPIM', 2, '12.00', '24.00'),
(44, 27, 8, 'produto', 8, 'ESPETINHO DE LINGUIÇA TOSCANA', 1, '8.99', '8.99'),
(45, 27, 18, 'produto', 18, 'ARROZ', 1, '9.97', '9.97'),
(46, 27, 19, 'produto', 19, 'MANDIOCA', 1, '6.50', '6.50'),
(47, 27, 21, 'produto', 21, 'VINAGRETE', 1, '6.50', '6.50'),
(48, 28, 6, 'produto', 6, 'ESPETINHO DE CARNE', 4, '11.00', '44.00'),
(49, 28, 7, 'produto', 7, 'ESPETINHO DE FRANGO', 3, '11.00', '33.00'),
(50, 28, 24, 'produto', 24, 'ESPETINHO DE CORAÇÃO DE FRANGO', 3, '12.00', '36.00'),
(51, 28, 8, 'produto', 8, 'ESPETINHO DE LINGUIÇA TOSCANA', 3, '8.99', '26.97'),
(52, 28, 34, 'produto', 34, 'ESPETINHO DE QUEIJO COALHO', 3, '9.99', '29.97'),
(53, 29, 12, 'produto', 12, 'GUARANA ANTARTICA 350ML', 2, '6.50', '13.00'),
(54, 29, 6, 'produto', 6, 'ESPETINHO DE CARNE', 1, '11.00', '11.00'),
(55, 29, 25, 'produto', 25, 'MEDALHAO DE FRANÇO', 1, '15.00', '15.00'),
(56, 29, 34, 'produto', 34, 'ESPETINHO DE QUEIJO COALHO', 1, '9.99', '9.99');

-- --------------------------------------------------------

--
-- Estrutura da tabela `itens_pedido_adicionais`
--

CREATE TABLE `itens_pedido_adicionais` (
  `id` int(11) NOT NULL,
  `item_pedido_id` int(11) NOT NULL,
  `pedido_id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `adicional_id` int(11) NOT NULL,
  `nome` varchar(120) NOT NULL,
  `preco` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `movimentacoes`
--

CREATE TABLE `movimentacoes` (
  `id` int(11) NOT NULL,
  `pedido_id` int(11) DEFAULT NULL,
  `valor` decimal(10,2) DEFAULT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `pedidos`
--

CREATE TABLE `pedidos` (
  `id` int(11) NOT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL,
  `pagamento` varchar(50) DEFAULT NULL,
  `observacao` text DEFAULT NULL,
  `status` varchar(30) DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `taxa_entrega` decimal(10,2) DEFAULT 0.00,
  `origem` varchar(20) DEFAULT 'WHATSAPP',
  `status_pagamento` varchar(20) DEFAULT 'PENDENTE',
  `id_pagamento` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `pedidos`
--

INSERT INTO `pedidos` (`id`, `cliente_id`, `total`, `pagamento`, `observacao`, `status`, `criado_em`, `taxa_entrega`, `origem`, `status_pagamento`, `id_pagamento`) VALUES
(1, NULL, '35.40', 'PIX', 'Endereço: Rua José Neves dos Santos | Referência: ', 'CONFIRMADO_CLIENTE', '2026-07-31 22:01:05', '2.50', 'WHATSAPP', 'PENDENTE', '170558970247'),
(2, 2, '52.50', 'PIX', 'Endereço: Rua Domingos Batista de Souza | Referência: ', 'ENTREGUE', '2026-07-31 22:17:31', '7.50', 'WHATSAPP', 'PENDENTE', '170561572661'),
(3, 3, '50.00', 'PIX', 'Endereço: Rua Primavera | Referência: Casa de esquina', 'ENTREGUE', '2026-07-31 23:46:12', '5.00', 'WHATSAPP', 'PAGO', '171475716156'),
(4, 4, '36.50', 'PIX', 'Endereço: Rua José Neves dos Santos | Referência: Condominio doce lar', 'ENTREGUE', '2026-08-01 00:28:22', '2.50', 'WHATSAPP', 'PENDENTE', '171479405798'),
(5, 5, '57.48', 'PIX', 'Endereço: Rua Ivanir de Sousa | Referência: ', 'AGUARDANDO_PIX', '2026-08-01 22:13:43', '7.50', 'WHATSAPP', 'PENDENTE', '170724183449'),
(24, 9, '154.96', 'PIX', 'Endereço: Rua José da Silva Galvão | Referência: ', 'AGUARDANDO_PIX', '2026-08-08 01:34:14', '0.00', 'WHATSAPP', 'PENDENTE', NULL),
(25, 9, '121.96', 'PIX', 'Endereço: Rua José da Silva Galvão | Referência: ', 'AGUARDANDO_PIX', '2026-08-08 01:38:41', '7.99', 'WHATSAPP', 'PENDENTE', '172666248206'),
(26, 10, '34.00', 'PIX', 'Endereço: Rua José Neves dos Santos, 15 - Jardim Nova Hortolândia II - Hortolândia/SP - 13183623 | Referência:  | Observação do pedido: Endereço: Rua José Neves dos Santos, 15 - Jardim Nova Hortolândia II - Hortolândia/SP - 13183623 | Referência:', 'AGUARDANDO_PIX', '2026-08-08 21:23:17', '0.00', 'WHATSAPP', 'PENDENTE', NULL),
(27, 11, '88.95', 'PIX', 'Endereço: Rua Odette Vieira Santos | Referência: Portão branco', 'ENTREGUE', '2026-08-08 23:40:54', '10.99', 'WHATSAPP', 'PAGO', '171911781009'),
(28, 12, '182.93', 'PIX', 'Endereço: Rua Rio Negro, 235 - Parque Orestes Ôngaro - Hortolândia/SP - 13183700 | Referência:  | Observação do pedido: Endereço: Rua Rio Negro, 235 - Parque Orestes Ôngaro - Hortolândia/SP - 13183700 | Referência:', 'AGUARDANDO_PIX', '2026-08-08 23:52:02', '12.99', 'WHATSAPP', 'PENDENTE', NULL),
(29, 13, '48.99', 'PIX', 'Endereço: Endereco nao informado | Referência:  | Observação do pedido: Endereço: Endereco nao informado | Referência:', 'EM_PREPARO', '2026-08-09 00:58:49', '0.00', 'WHATSAPP', 'PAGO', '172831599448');

-- --------------------------------------------------------

--
-- Estrutura da tabela `pedido_embalagens_padrao`
--

CREATE TABLE `pedido_embalagens_padrao` (
  `id` int(11) NOT NULL,
  `embalagem_id` int(11) NOT NULL,
  `quantidade` int(11) NOT NULL DEFAULT 1,
  `ativo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `produtos`
--

CREATE TABLE `produtos` (
  `id` int(11) NOT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `nome` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `preco` decimal(10,2) DEFAULT NULL,
  `imagem` varchar(255) DEFAULT NULL,
  `ativo` tinyint(4) DEFAULT 1,
  `destaque` tinyint(4) DEFAULT 0,
  `estoque` int(11) DEFAULT 0,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `ordem` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `produtos`
--

INSERT INTO `produtos` (`id`, `categoria_id`, `nome`, `descricao`, `preco`, `imagem`, `ativo`, `destaque`, `estoque`, `criado_em`, `ordem`) VALUES
(6, 1, 'ESPETINHO DE CARNE', '', '11.00', '1785249344_7.png', 1, 0, 35, '2026-07-09 01:27:56', 1),
(7, 1, 'ESPETINHO DE FRANGO', '', '11.00', '1785249385_6.png', 1, 0, 4, '2026-07-09 01:29:22', 2),
(8, 1, 'ESPETINHO DE LINGUIÇA TOSCANA', '', '8.99', '1785249403_8.png', 1, 0, 12, '2026-07-09 01:30:43', 3),
(9, 4, 'COCA COLA 350ML', '', '6.90', '1785268889_7.png', 1, 0, 21, '2026-07-09 01:31:35', 5),
(10, 4, 'FANTA LARANJA 350 ML', '', '6.90', '1785268906_6.png', 0, 0, 100, '2026-07-09 01:34:53', 6),
(11, 4, 'FANTA UVA 350ML', '', '6.90', '1785268918_5.png', 0, 0, 100, '2026-07-09 02:53:24', 7),
(12, 4, 'GUARANA ANTARTICA 350ML', '', '6.50', '1785268937_4.png', 1, 0, 20, '2026-07-09 02:54:37', 8),
(13, 4, 'ORIGINAL 350ML', '', '7.50', '1785268952_2.png', 0, 1, 24, '2026-07-09 02:55:26', 9),
(14, 4, 'BRAHMA 350ML', '', '7.00', '1785268968_8.png', 0, 0, 99, '2026-07-09 02:56:08', 10),
(15, 4, 'SKOL 350ML', '', '6.98', '1785269004_1.png', 0, 1, 18, '2026-07-09 02:57:12', 11),
(16, 4, 'HINEKEN 350ML', '', '9.00', '1785269018_3.png', 0, 0, 99, '2026-07-09 02:58:23', 12),
(17, 1, 'ESPETINHO DE CUPIM', '', '12.00', '1785249455_9.png', 1, 0, 10, '2026-07-17 20:32:01', 4),
(18, 6, 'ARROZ', 'Porção de 400g', '9.97', '1785250343_4.png', 1, 0, 997, '2026-07-18 04:41:58', 13),
(19, 6, 'MANDIOCA', 'Porçao de 200g', '6.50', '1785250359_1.png', 1, 0, 994, '2026-07-18 04:42:38', 14),
(20, 6, 'FAROFA GOURMET', 'Porçao de 200g', '8.00', '1785250375_3.png', 1, 0, 997, '2026-07-18 04:43:06', 15),
(21, 6, 'VINAGRETE', 'Porção de 100g', '6.50', '1785250392_2.png', 1, 0, 999, '2026-07-18 04:43:40', 16),
(22, 4, 'COCA COLA 200ML', '', '4.00', '1785268869_Design_sem_nome.png', 1, 0, 19, '2026-07-28 20:01:09', 17),
(23, 1, 'KAFTA', '', '9.99', '1785269568_5.png', 1, 0, 38, '2026-07-28 20:12:48', 18),
(24, 1, 'ESPETINHO DE CORAÇÃO DE FRANGO', '', '12.00', '1785269645_10.png', 1, 0, 2, '2026-07-28 20:14:05', 24),
(25, 1, 'MEDALHAO DE FRANÇO', '', '15.00', '1785269725_4.png', 1, 0, 5, '2026-07-28 20:15:25', 19),
(26, 1, 'PAO DE ALHO COM QUEJO', '', '8.50', '1785269859_3.png', 0, 1, 10, '2026-07-28 20:17:39', 20),
(27, 1, 'PAO DE ALHO COM BACON', '', '8.50', '1785269916_3.png', 0, 1, 10, '2026-07-28 20:18:36', 21),
(28, 1, 'TILIPA', '', '11.00', '1785269963_1.png', 0, 1, 0, '2026-07-28 20:19:23', 22),
(29, 3, '1 - COMBO CASAL', '2 Espetinhos ( Carne e frango)\r\n2 Coca Cola 350ml \r\nFarofa Gourmet \r\nVinagrete\r\nMandioca', '32.90', '1785276771_1.png', 1, 0, 8, '2026-07-28 22:05:01', 23),
(30, 3, '2 - COMBO ESPECIAL', '3 Espetos ( Carne, Frango, linguinça)\r\n2 Coca cola 350 ml\r\nFarofa Gourmet \r\nVinagret\r\nMandioca', '49.50', '1785276798_2.png', 1, 0, 99, '2026-07-28 22:12:02', 25),
(31, 3, '3 - COMBO TO COM FOME', '4 Espetinho ( Carne, Frango, Linguinça, Coração),\r\n2 Coca cola,\r\nFarofa Gourmet,\r\nVinagret,\r\nMandioca.', '69.90', '1785277204_3.png', 1, 0, 97, '2026-07-28 22:20:04', 26),
(32, 5, 'Marmitinha do chef 01', '1 Espetinho de Carne, 1 coca cola 200ml Arroz, Farofa Gourmet, Vinagreta, Mandioca, molhos', '24.99', '1785985676_IMG-20260804-WA0035.jpg', 0, 0, 91, '2026-07-28 22:37:05', 27),
(33, 5, 'JANTINHA COM REFRIGERANTE', '2 Espetinho de Carne, 1 coca cola 200ml Arroz, Farofa Gourmet, Vinagreta, Mandioca, coca cola 200ml, molhos', '35.99', '1785985892_IMG-20260804-WA0036.jpg', 0, 0, 96, '2026-07-28 22:40:53', 28),
(34, 1, 'ESPETINHO DE QUEIJO COALHO', '', '9.99', '1785358397_queijo_coalho.png', 1, 0, 11, '2026-07-29 20:53:17', 29),
(35, 8, 'CHURRASCO NO PAO ( CONTRA-FILÉ)', 'Pão Françes, Alfaçe, Vinagrete, Contra-file, Mussarela', '20.00', '1786130163_contra_file.jpg', 1, 0, 19, '2026-08-07 19:11:47', 30),
(36, 8, 'CHURRASCO NO PAO ( FILÉ DE FRANGO)', 'Pão Françes, Alfaçe, Vinagrete, File de frango, Mussarela', '18.00', '1786130508_frango.png', 1, 0, 20, '2026-08-07 19:13:49', 31),
(37, 8, 'CHURRASCO NO PAO ( LINGUIÇA)', 'Pão Françes, Alfaçe, Vinagrete, Linguiça, Mussarela', '18.00', '1786130527_frango.png', 1, 0, 20, '2026-08-07 19:19:10', 32);

-- --------------------------------------------------------

--
-- Estrutura da tabela `produto_adicionais`
--

CREATE TABLE `produto_adicionais` (
  `id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `adicional_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `produto_embalagens`
--

CREATE TABLE `produto_embalagens` (
  `id` int(11) NOT NULL,
  `produto_id` int(11) NOT NULL,
  `embalagem_id` int(11) NOT NULL,
  `quantidade` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `promocoes`
--

CREATE TABLE `promocoes` (
  `id` int(11) NOT NULL,
  `titulo` varchar(150) NOT NULL,
  `descricao` text DEFAULT NULL,
  `imagem` varchar(255) DEFAULT NULL,
  `produto_id` int(11) DEFAULT NULL,
  `preco_promocional` decimal(10,2) DEFAULT 0.00,
  `data_inicio` date DEFAULT NULL,
  `data_fim` date DEFAULT NULL,
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `promocoes`
--

INSERT INTO `promocoes` (`id`, `titulo`, `descricao`, `imagem`, `produto_id`, `preco_promocional`, `data_inicio`, `data_fim`, `ativo`, `criado_em`) VALUES
(3, '🔥 FICOU COM FOME? Seu churrasco no pão chegou! 🥩🥖', 'Escolha sua carne:\r\n✅ Contrafilé suculento\r\n✅ Frango grelhado\r\n✅ Linguiça defumada\r\n\r\nE vem completão:\r\nPão francês fresquinho • Alface crocante • Vinagrete caseiro • Queijo prato derretido • Ketchup • Molho de alho especial 🧄🧀\r\n\r\n🍔 Peça pelo nosso APP e receba na sua casa (ou retire na loja) – você quem manda!\r\n📲 Link direto: 👉 https://espetarianabrasa.giize.com/espetaria-public/public/\r\n\r\n⚠️ Atendimento rápido e entrega quentinha – não deixe a fome esperar!', '', 35, '20.00', '2026-08-12', '2026-08-16', 1, '2026-08-09 22:59:48');

-- --------------------------------------------------------

--
-- Estrutura da tabela `usuarios_sistema`
--

CREATE TABLE `usuarios_sistema` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `nivel` enum('ADM','GERENTE') NOT NULL DEFAULT 'GERENTE',
  `ativo` tinyint(1) DEFAULT 1,
  `criado_em` timestamp NOT NULL DEFAULT current_timestamp(),
  `telefone` varchar(30) DEFAULT NULL,
  `foto` varchar(255) DEFAULT NULL,
  `ultimo_acesso` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Extraindo dados da tabela `usuarios_sistema`
--

INSERT INTO `usuarios_sistema` (`id`, `nome`, `usuario`, `senha`, `nivel`, `ativo`, `criado_em`, `telefone`, `foto`, `ultimo_acesso`) VALUES
(1, 'Administrador', 'admin', '$2y$10$9eDOonXnOTRLNCk5nNgc3.jPqrw6Tj/WQYRDm8t2Qrhf3pxxRsHNm', 'ADM', 1, '2026-06-11 01:34:08', '', 'perfil_1_1781145507.png', '2026-06-15 01:08:39'),
(3, 'Marcelo', 'Marcelo', '$2y$10$vLWm/tFtyrfnVwQceZtngOvwyGr9d3DVzOFGgoNOJAIpW9ETu17l2', 'ADM', 1, '2026-06-15 01:09:41', '', 'perfil_3_1781569649.png', '2026-08-09 22:48:34');

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `adicionais`
--
ALTER TABLE `adicionais`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `bairros`
--
ALTER TABLE `bairros`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `telefone` (`telefone`),
  ADD KEY `idx_cliente_cep` (`cep`);

--
-- Índices para tabela `comandas`
--
ALTER TABLE `comandas`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `comanda_itens`
--
ALTER TABLE `comanda_itens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `comanda_id` (`comanda_id`),
  ADD KEY `produto_id` (`produto_id`);

--
-- Índices para tabela `combos`
--
ALTER TABLE `combos`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `combo_opcoes_escolha`
--
ALTER TABLE `combo_opcoes_escolha`
  ADD PRIMARY KEY (`id`),
  ADD KEY `combo_id` (`combo_id`),
  ADD KEY `produto_id` (`produto_id`);

--
-- Índices para tabela `combo_produtos`
--
ALTER TABLE `combo_produtos`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `configuracoes`
--
ALTER TABLE `configuracoes`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `configuracoes_whatsapp`
--
ALTER TABLE `configuracoes_whatsapp`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `cupons`
--
ALTER TABLE `cupons`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `embalagem_movimentacoes`
--
ALTER TABLE `embalagem_movimentacoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `embalagem_id` (`embalagem_id`);

--
-- Índices para tabela `embalagens`
--
ALTER TABLE `embalagens`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `entregadores`
--
ALTER TABLE `entregadores`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `estoque_movimentacoes`
--
ALTER TABLE `estoque_movimentacoes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `produto_id` (`produto_id`);

--
-- Índices para tabela `financeiro`
--
ALTER TABLE `financeiro`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_financeiro_pedido_id` (`pedido_id`),
  ADD KEY `idx_financeiro_data` (`data_movimento`);

--
-- Índices para tabela `itens_pedido`
--
ALTER TABLE `itens_pedido`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pedido_id` (`pedido_id`),
  ADD KEY `produto_id` (`produto_id`),
  ADD KEY `idx_itens_pedido_tipo_item` (`tipo_item`),
  ADD KEY `idx_itens_pedido_item_id` (`item_id`);

--
-- Índices para tabela `itens_pedido_adicionais`
--
ALTER TABLE `itens_pedido_adicionais`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `movimentacoes`
--
ALTER TABLE `movimentacoes`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cliente_id` (`cliente_id`);

--
-- Índices para tabela `pedido_embalagens_padrao`
--
ALTER TABLE `pedido_embalagens_padrao`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `embalagem_pedido_unica` (`embalagem_id`),
  ADD KEY `embalagem_id` (`embalagem_id`);

--
-- Índices para tabela `produtos`
--
ALTER TABLE `produtos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `categoria_id` (`categoria_id`),
  ADD KEY `idx_produtos_ordem` (`ordem`);

--
-- Índices para tabela `produto_adicionais`
--
ALTER TABLE `produto_adicionais`
  ADD PRIMARY KEY (`id`),
  ADD KEY `produto_id` (`produto_id`),
  ADD KEY `adicional_id` (`adicional_id`);

--
-- Índices para tabela `produto_embalagens`
--
ALTER TABLE `produto_embalagens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `produto_embalagem_unica` (`produto_id`,`embalagem_id`),
  ADD KEY `produto_id` (`produto_id`),
  ADD KEY `embalagem_id` (`embalagem_id`);

--
-- Índices para tabela `promocoes`
--
ALTER TABLE `promocoes`
  ADD PRIMARY KEY (`id`);

--
-- Índices para tabela `usuarios_sistema`
--
ALTER TABLE `usuarios_sistema`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario` (`usuario`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `adicionais`
--
ALTER TABLE `adicionais`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `admin`
--
ALTER TABLE `admin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `bairros`
--
ALTER TABLE `bairros`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de tabela `clientes`
--
ALTER TABLE `clientes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de tabela `comandas`
--
ALTER TABLE `comandas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `comanda_itens`
--
ALTER TABLE `comanda_itens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `combos`
--
ALTER TABLE `combos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT de tabela `combo_opcoes_escolha`
--
ALTER TABLE `combo_opcoes_escolha`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de tabela `combo_produtos`
--
ALTER TABLE `combo_produtos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de tabela `configuracoes`
--
ALTER TABLE `configuracoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `configuracoes_whatsapp`
--
ALTER TABLE `configuracoes_whatsapp`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `cupons`
--
ALTER TABLE `cupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `embalagem_movimentacoes`
--
ALTER TABLE `embalagem_movimentacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `embalagens`
--
ALTER TABLE `embalagens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `entregadores`
--
ALTER TABLE `entregadores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `estoque_movimentacoes`
--
ALTER TABLE `estoque_movimentacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=88;

--
-- AUTO_INCREMENT de tabela `financeiro`
--
ALTER TABLE `financeiro`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=93;

--
-- AUTO_INCREMENT de tabela `itens_pedido`
--
ALTER TABLE `itens_pedido`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=57;

--
-- AUTO_INCREMENT de tabela `itens_pedido_adicionais`
--
ALTER TABLE `itens_pedido_adicionais`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `movimentacoes`
--
ALTER TABLE `movimentacoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT de tabela `pedido_embalagens_padrao`
--
ALTER TABLE `pedido_embalagens_padrao`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT de tabela `produto_adicionais`
--
ALTER TABLE `produto_adicionais`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `produto_embalagens`
--
ALTER TABLE `produto_embalagens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `promocoes`
--
ALTER TABLE `promocoes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de tabela `usuarios_sistema`
--
ALTER TABLE `usuarios_sistema`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restrições para despejos de tabelas
--

--
-- Limitadores para a tabela `comanda_itens`
--
ALTER TABLE `comanda_itens`
  ADD CONSTRAINT `fk_comanda_itens_comanda` FOREIGN KEY (`comanda_id`) REFERENCES `comandas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_comanda_itens_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`);

--
-- Limitadores para a tabela `combo_opcoes_escolha`
--
ALTER TABLE `combo_opcoes_escolha`
  ADD CONSTRAINT `combo_opcoes_escolha_ibfk_1` FOREIGN KEY (`combo_id`) REFERENCES `combos` (`id`),
  ADD CONSTRAINT `combo_opcoes_escolha_ibfk_2` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`);

--
-- Limitadores para a tabela `estoque_movimentacoes`
--
ALTER TABLE `estoque_movimentacoes`
  ADD CONSTRAINT `fk_estoque_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Limitadores para a tabela `itens_pedido`
--
ALTER TABLE `itens_pedido`
  ADD CONSTRAINT `itens_pedido_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`),
  ADD CONSTRAINT `itens_pedido_ibfk_2` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`);

--
-- Limitadores para a tabela `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`);

--
-- Limitadores para a tabela `produtos`
--
ALTER TABLE `produtos`
  ADD CONSTRAINT `produtos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`);

--
-- Limitadores para a tabela `produto_adicionais`
--
ALTER TABLE `produto_adicionais`
  ADD CONSTRAINT `produto_adicionais_ibfk_1` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`),
  ADD CONSTRAINT `produto_adicionais_ibfk_2` FOREIGN KEY (`adicional_id`) REFERENCES `adicionais` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
