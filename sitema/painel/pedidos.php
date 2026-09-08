<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

date_default_timezone_set('America/Sao_Paulo');

/*
|--------------------------------------------------------------------------
| CONTROLE DE EXPEDIENTE NO BANCO
|--------------------------------------------------------------------------
| Antes o sistema usava $_SESSION para abrir/fechar a loja.
| Sessão só vale no painel e o bot do WhatsApp não consegue enxergar.
| Agora o status fica salvo na tabela configuracoes.
*/

function colunaExiste($conn, $tabela, $coluna){
    $tabela = $conn->real_escape_string($tabela);
    $coluna = $conn->real_escape_string($coluna);

    $res = $conn->query("
        SELECT COUNT(*) total
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '$tabela'
        AND COLUMN_NAME = '$coluna'
    ");

    if(!$res){
        return false;
    }

    $row = $res->fetch_assoc();
    return intval($row['total'] ?? 0) > 0;
}

function garantirControleLoja($conn){

    if(!colunaExiste($conn, 'configuracoes', 'loja_aberta')){
        $conn->query("
            ALTER TABLE configuracoes
            ADD COLUMN loja_aberta TINYINT(1) NOT NULL DEFAULT 0
        ");
    }

    if(!colunaExiste($conn, 'configuracoes', 'expediente_aberto_em')){
        $conn->query("
            ALTER TABLE configuracoes
            ADD COLUMN expediente_aberto_em DATETIME DEFAULT NULL
        ");
    }

    if(!colunaExiste($conn, 'configuracoes', 'expediente_fechado_em')){
        $conn->query("
            ALTER TABLE configuracoes
            ADD COLUMN expediente_fechado_em DATETIME DEFAULT NULL
        ");
    }

    $existeConfig = $conn->query("SELECT id FROM configuracoes ORDER BY id ASC LIMIT 1");

    if(!$existeConfig || $existeConfig->num_rows == 0){
        $conn->query("
            INSERT INTO configuracoes (id, nome_empresa, loja_aberta, expediente_aberto_em, expediente_fechado_em)
            VALUES (1, 'Espetaria', 0, NULL, NULL)
        ");
    }
}

function obterConfigLoja($conn){
    $res = $conn->query("
        SELECT id, loja_aberta, expediente_aberto_em, expediente_fechado_em
        FROM configuracoes
        ORDER BY id ASC
        LIMIT 1
    ");

    if($res && $res->num_rows > 0){
        return $res->fetch_assoc();
    }

    return [
        'id' => 1,
        'loja_aberta' => 0,
        'expediente_aberto_em' => null,
        'expediente_fechado_em' => null
    ];
}

garantirControleLoja($conn);

$configLoja = obterConfigLoja($conn);
$idConfigLoja = intval($configLoja['id'] ?? 1);
$lojaAberta = intval($configLoja['loja_aberta'] ?? 0) === 1;
$expedienteInicio = $configLoja['expediente_aberto_em'] ?? null;

/*
|--------------------------------------------------------------------------
| AJAX - VERIFICAR ÚLTIMO PEDIDO PARA SOM
|--------------------------------------------------------------------------
*/

if(isset($_GET['ajax_ultimo_pedido'])){

    $ultimoPedido = 0;

    if($lojaAberta && !empty($expedienteInicio)){
        $inicioSeguro = $conn->real_escape_string($expedienteInicio);

        $ultimo = $conn->query("
            SELECT MAX(id) ultimo
            FROM pedidos
            WHERE criado_em >= '$inicioSeguro'
        ")->fetch_assoc();

        $ultimoPedido = intval($ultimo['ultimo'] ?? 0);
    }

    header('Content-Type: application/json');
    echo json_encode([
        'ultimo' => $ultimoPedido
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| AJAX - VERIFICAR STATUS DA LOJA
|--------------------------------------------------------------------------
*/

if(isset($_GET['ajax_status_loja'])){

    $configAtual = obterConfigLoja($conn);
    $statusLoja = intval($configAtual['loja_aberta'] ?? 0) === 1;

    header('Content-Type: application/json');
    echo json_encode([
        'aberta' => $statusLoja,
        'expediente_aberto_em' => $configAtual['expediente_aberto_em'] ?? null
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| ALTERAR STATUS DA LOJA
|--------------------------------------------------------------------------
*/

if(isset($_GET['toggle_loja'])){

    $agora = date('Y-m-d H:i:s');
    $novoStatus = !$lojaAberta;

    if($novoStatus){
        // Abrir loja = começa um novo expediente.
        // Tudo que foi feito antes deste horário some da tela principal de pedidos.
        $conn->query("
            UPDATE configuracoes
            SET loja_aberta = 1,
                expediente_aberto_em = '$agora',
                expediente_fechado_em = NULL
            WHERE id = '$idConfigLoja'
        ");

        $lojaAberta = true;
        $expedienteInicio = $agora;

    } else {
        // Fechar loja = o painel fica limpo e o bot passa a responder que está fechado.
        $conn->query("
            UPDATE configuracoes
            SET loja_aberta = 0,
                expediente_fechado_em = '$agora'
            WHERE id = '$idConfigLoja'
        ");

        $lojaAberta = false;
    }

    header('Content-Type: application/json');
    echo json_encode([
        'sucesso' => true,
        'aberta' => $lojaAberta,
        'expediente_aberto_em' => $expedienteInicio
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| ALTERAR STATUS
|--------------------------------------------------------------------------
*/

function notificarClientePedido($telefone, $mensagem){

    if(empty($telefone) || empty($mensagem)){
        return false;
    }

    $telefone = preg_replace('/\D/', '', $telefone);

    if(empty($telefone)){
        return false;
    }

    $dados = json_encode([
        'telefone' => $telefone . '@c.us',
        'mensagem' => $mensagem
    ]);

    $ch = curl_init('http://127.0.0.1:4000/notificar-pedido');

    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $dados);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $resposta = curl_exec($ch);
    curl_close($ch);

    return $resposta;
}

if(isset($_GET['status']) && isset($_GET['id'])){

    $id = intval($_GET['id']);
    $status = $_GET['status'];

    $permitidos = [
        'AGUARDANDO_PAGAMENTO',
        'AGUARDANDO_PIX',
        'PAGO',
        'EM_PREPARO',
        'PRONTO',
        'SAIU_ENTREGA',
        'ENTREGUE',
        'CONFIRMADO_CLIENTE',
        'CANCELADO'
    ];

    if(in_array($status, $permitidos)){

        $statusSeguro = $conn->real_escape_string($status);

        $conn->query("
            UPDATE pedidos
            SET status='$statusSeguro'
            WHERE id='$id'
        ");

        $pedidoNotificacao = $conn->query("
            SELECT
                p.id,
                p.status,
                c.nome,
                c.telefone
            FROM pedidos p
            LEFT JOIN clientes c ON c.id = p.cliente_id
            WHERE p.id = '$id'
            LIMIT 1
        ");

        if($pedidoNotificacao && $pedidoNotificacao->num_rows > 0){

            $dadosPedido = $pedidoNotificacao->fetch_assoc();

            $nomeCliente = $dadosPedido['nome'] ?: 'cliente';
            $telefoneCliente = $dadosPedido['telefone'];

            if($status == 'EM_PREPARO'){

                notificarClientePedido(
                    $telefoneCliente,
                    "🍢 Olá {$nomeCliente}!\n\nSeu pedido #{$id} está em preparo.\n\nAssim que estiver pronto, avisaremos por aqui."
                );

            } elseif($status == 'PRONTO'){

                notificarClientePedido(
                    $telefoneCliente,
                    "✅ Olá {$nomeCliente}!\n\nSeu pedido #{$id} está pronto.\n\nEm breve ele sairá para entrega."
                );

            } elseif($status == 'SAIU_ENTREGA'){

                notificarClientePedido(
                    $telefoneCliente,
                    "🛵 Olá {$nomeCliente}!\n\nSeu pedido #{$id} saiu para entrega.\n\nFique atento ao WhatsApp."
                );

            } elseif($status == 'ENTREGUE'){

                notificarClientePedido(
                    $telefoneCliente,
                    "✅ Olá {$nomeCliente}!\n\nSeu pedido #{$id} foi marcado como entregue.\n\nPor favor, responda *recebido* para confirmar que recebeu corretamente."
                );

            } elseif($status == 'CANCELADO'){

                notificarClientePedido(
                    $telefoneCliente,
                    "❌ Olá {$nomeCliente}.\n\nSeu pedido #{$id} foi cancelado.\n\nSe tiver dúvidas, fale com nosso atendimento."
                );
            }
        }
    }

    header("Location: pedidos.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| FILTRO - MOSTRAR APENAS PEDIDOS DO EXPEDIENTE ATUAL
|--------------------------------------------------------------------------
*/

$where = "WHERE 1=0";
$whereExpediente = "1=0";

if($lojaAberta && !empty($expedienteInicio)){

    $inicioSeguro = $conn->real_escape_string($expedienteInicio);

    // Mostra somente pedidos criados depois da última abertura da loja.
    // Assim, se fechar e abrir no mesmo dia, os pedidos antigos não voltam para a tela.
    $where = "WHERE p.criado_em >= '$inicioSeguro'";
    $whereExpediente = "criado_em >= '$inicioSeguro'";

    if(isset($_GET['filtro']) && $_GET['filtro'] != ''){
        $filtro = $conn->real_escape_string($_GET['filtro']);
        $where .= " AND p.status='$filtro'";
    }
}

/*
|--------------------------------------------------------------------------
| DASHBOARD - APENAS PEDIDOS DO EXPEDIENTE ATUAL
|--------------------------------------------------------------------------
*/

$aguardando = 0;
$pagos = 0;
$preparo = 0;
$entregues = 0;
$faturamento = 0;

if($lojaAberta && !empty($expedienteInicio)){

    $aguardando =
    $conn->query("
    SELECT COUNT(*) total
    FROM pedidos
    WHERE $whereExpediente
    AND (status='AGUARDANDO_PAGAMENTO' OR status='AGUARDANDO_PIX')
    ")->fetch_assoc()['total'];

    $pagos =
    $conn->query("
    SELECT COUNT(*) total
    FROM pedidos
    WHERE $whereExpediente
    AND status='PAGO'
    ")->fetch_assoc()['total'];

    $preparo =
    $conn->query("
    SELECT COUNT(*) total
    FROM pedidos
    WHERE $whereExpediente
    AND status='EM_PREPARO'
    ")->fetch_assoc()['total'];

    $entregues =
    $conn->query("
    SELECT COUNT(*) total
    FROM pedidos
    WHERE $whereExpediente
    AND (status='ENTREGUE' OR status='CONFIRMADO_CLIENTE')
    ")->fetch_assoc()['total'];

    $faturamento =
    $conn->query("
    SELECT COALESCE(SUM(total),0) total
    FROM pedidos
    WHERE $whereExpediente
    ")->fetch_assoc()['total'];
}

/*
|--------------------------------------------------------------------------
| PEDIDOS - APENAS DO EXPEDIENTE ATUAL
|--------------------------------------------------------------------------
*/

$pedidos =
$conn->query("
SELECT
p.*,
c.nome,
c.telefone,
c.bairro
FROM pedidos p

LEFT JOIN clientes c
ON c.id=p.cliente_id

$where

ORDER BY p.id DESC
");
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pedidos</title>

<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/pedidos.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">


<script>
// Funções de áudio
function beep(){
    try{
        const audio = new Audio('assets/audio/novo-pedido.mp3');
        audio.volume = 1;
        audio.play().catch(function(){
            gerarBeepAlternativo();
        });
    }catch(e){
        gerarBeepAlternativo();
    }
}

function gerarBeepAlternativo(){
    try{
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.4;

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        setTimeout(function(){
            osc.stop();
            ctx.close();
        }, 900);
    }catch(e){}
}

// Gerenciar estado da loja
let lojaAberta = false;
let somAtivado = false;
let temporizadorPiscar = null;

// Função para mostrar notificação de novo pedido
function mostrarNotificacao(pedidoId) {
    const notificacao = document.createElement('div');
    notificacao.className = 'notificacao-pedido';
    notificacao.innerHTML = `
        <strong>🔔 NOVO PEDIDO!</strong><br>
        Pedido #${pedidoId} acabou de chegar!
    `;
    document.body.appendChild(notificacao);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (notificacao.parentNode) {
            notificacao.remove();
        }
    }, 5000);
}

// Função para iniciar piscar do pedido
function iniciarPiscarPedido(pedidoId) {
    const pedidoCard = document.querySelector(`.pedido-card[data-id="${pedidoId}"]`);
    if (pedidoCard) {
        // Adicionar classe de novo pedido com destaque
        pedidoCard.classList.add('novo-pedido');
        pedidoCard.classList.add('novo-pedido-destaque');
        
        // Adicionar badge de novo
        const badge = document.createElement('span');
        badge.className = 'badge-novo';
        badge.textContent = 'NOVO!';
        pedidoCard.appendChild(badge);
        
        // Mostrar notificação na tela
        mostrarNotificacao(pedidoId);
        
        // Tocar som
        if (somAtivado) {
            beep();
            // Tocar som repetidamente por 30 segundos
            let contador = 0;
            const intervalo = setInterval(() => {
                if (contador < 3) { // 3 vezes durante 30 segundos
                    beep();
                    contador++;
                } else {
                    clearInterval(intervalo);
                }
            }, 10000); // A cada 10 segundos
        }
        
        // Remover efeitos após 30 segundos
        if (temporizadorPiscar) {
            clearTimeout(temporizadorPiscar);
        }
        
        temporizadorPiscar = setTimeout(() => {
            if (pedidoCard) {
                pedidoCard.classList.remove('novo-pedido');
                pedidoCard.classList.remove('novo-pedido-destaque');
                const badgeExistente = pedidoCard.querySelector('.badge-novo');
                if (badgeExistente) {
                    badgeExistente.remove();
                }
                // Marcar como aberto
                pedidoCard.classList.add('aberto');
                // Salvar no localStorage
                const abertos = JSON.parse(localStorage.getItem('pedidosAbertos') || '[]');
                if (!abertos.includes(pedidoId)) {
                    abertos.push(pedidoId);
                    localStorage.setItem('pedidosAbertos', JSON.stringify(abertos));
                }
            }
        }, 30000); // 30 segundos
    }
}

// Função para atualizar interface da loja
function atualizarInterfaceLoja(aberta) {
    const btnLoja = document.getElementById('btnLoja');
    const statusLoja = document.getElementById('statusLoja');
    const body = document.querySelector('.main');
    
    lojaAberta = aberta;
    
    if (aberta) {
        btnLoja.textContent = '🔴 Fechar Loja';
        btnLoja.className = 'btn-loja fechar';
        statusLoja.textContent = '🟢 Loja Aberta';
        statusLoja.className = 'status-loja aberta';
        body.classList.remove('loja-fechada');
    } else {
        btnLoja.textContent = '🟢 Abrir Loja';
        btnLoja.className = 'btn-loja abrir';
        statusLoja.textContent = '🔴 Loja Fechada';
        statusLoja.className = 'status-loja fechada';
        body.classList.add('loja-fechada');
    }
}

// Função para toggle da loja
async function toggleLoja() {
    try {
        const response = await fetch('pedidos.php?toggle_loja=1');
        const data = await response.json();

        if (!data.sucesso) {
            alert('Não foi possível alterar o status da loja.');
            return;
        }

        // Novo expediente: limpa a marcação local de pedidos já abertos.
        localStorage.removeItem('pedidosAbertos');

        atualizarInterfaceLoja(data.aberta);
        location.reload();

    } catch(error) {
        console.error('Erro ao alternar loja:', error);
        alert('Erro ao abrir/fechar a loja.');
    }
}

// Função para toggle do som
function toggleSom() {
    const btnSom = document.getElementById('btnSom');
    somAtivado = !somAtivado;
    localStorage.setItem('somAtivado', somAtivado ? '1' : '0');
    
    if (somAtivado) {
        btnSom.textContent = '🔊 Som Ativado';
        btnSom.className = 'btn-som ativo';
        beep(); // Teste de som
    } else {
        btnSom.textContent = '🔇 Som Desativado';
        btnSom.className = 'btn-som';
    }
}

// Função para marcar pedido como aberto (clique manual)
function marcarPedidoAberto(pedidoId) {
    const pedidoCard = document.querySelector(`.pedido-card[data-id="${pedidoId}"]`);
    if (pedidoCard) {
        // Remover animações
        pedidoCard.classList.remove('novo-pedido');
        pedidoCard.classList.remove('novo-pedido-destaque');
        
        // Remover badge
        const badge = pedidoCard.querySelector('.badge-novo');
        if (badge) {
            badge.remove();
        }
        
        // Marcar como aberto
        pedidoCard.classList.add('aberto');
        
        // Salvar no localStorage
        const abertos = JSON.parse(localStorage.getItem('pedidosAbertos') || '[]');
        if (!abertos.includes(pedidoId)) {
            abertos.push(pedidoId);
            localStorage.setItem('pedidosAbertos', JSON.stringify(abertos));
        }
        
        // Cancelar temporizador se existir
        if (temporizadorPiscar) {
            clearTimeout(temporizadorPiscar);
            temporizadorPiscar = null;
        }
    }
}

// Função para verificar pedidos abertos
function verificarPedidosAbertos() {
    const abertos = JSON.parse(localStorage.getItem('pedidosAbertos') || '[]');
    document.querySelectorAll('.pedido-card').forEach(card => {
        const id = card.dataset.id;
        if (id) {
            if (abertos.includes(parseInt(id))) {
                card.classList.remove('novo-pedido');
                card.classList.remove('novo-pedido-destaque');
                card.classList.add('aberto');
                const badge = card.querySelector('.badge-novo');
                if (badge) {
                    badge.remove();
                }
            } else {
                // Se não está nos abertos, mas tem classe de novo, mantém
                if (card.classList.contains('novo-pedido')) {
                    // Iniciar contagem de 30 segundos
                    const pedidoId = parseInt(id);
                    iniciarPiscarPedido(pedidoId);
                }
            }
        }
    });
}

// Função para verificar novos pedidos
async function verificarNovosPedidos() {
    try {
        const resposta = await fetch('pedidos.php?ajax_ultimo_pedido=1');
        const dados = await resposta.json();
        const ultimoBanco = parseInt(dados.ultimo || 0);

        if (window.ultimoPedido === undefined) {
            window.ultimoPedido = ultimoBanco;
            return;
        }

        if (ultimoBanco > window.ultimoPedido && lojaAberta) {
            window.ultimoPedido = ultimoBanco;
            
            // Iniciar piscar para o novo pedido
            iniciarPiscarPedido(ultimoBanco);

            // Recarregar a página após 2 segundos para mostrar o novo pedido
            setTimeout(function(){
                location.reload();
            }, 2000);
        }
    } catch(e) {
        console.log('Erro ao verificar novo pedido:', e);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Carregar estado do som
    somAtivado = localStorage.getItem('somAtivado') === '1';
    const btnSom = document.getElementById('btnSom');
    
    if (somAtivado) {
        btnSom.textContent = '🔊 Som Ativado';
        btnSom.className = 'btn-som ativo';
    } else {
        btnSom.textContent = '🔇 Som Desativado';
        btnSom.className = 'btn-som';
    }

    // Carregar estado da loja
    const lojaAbertaStatus = document.querySelector('.status-loja');
    if (lojaAbertaStatus) {
        const isOpen = lojaAbertaStatus.classList.contains('aberta');
        lojaAberta = isOpen;
    }

    // Verificar pedidos abertos
    verificarPedidosAbertos();

    // Adicionar evento de clique para cada pedido
    document.querySelectorAll('.pedido-card').forEach(card => {
        const id = card.dataset.id;
        if (id) {
            const abertos = JSON.parse(localStorage.getItem('pedidosAbertos') || '[]');
            if (!abertos.includes(parseInt(id))) {
                card.onclick = function(e) {
                    // Não disparar se clicou em um botão
                    if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
                        marcarPedidoAberto(parseInt(id));
                    }
                };
            }
        }
    });

    // Iniciar verificação periódica
    setInterval(verificarNovosPedidos, 5000);

    // Verificar status da loja periodicamente
    setInterval(async function() {
        try {
            const response = await fetch('pedidos.php?ajax_status_loja=1');
            const data = await response.json();
            if (data.aberta !== lojaAberta) {
                location.reload();
            }
        } catch(e) {
            console.log('Erro ao verificar status da loja:', e);
        }
    }, 10000);
});
</script>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main <?= ($lojaAberta ? '' : 'loja-fechada') ?>">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<div class="top-controls">
    <button id="btnLoja" class="btn-loja <?= ($lojaAberta ? 'fechar' : 'abrir') ?>" onclick="toggleLoja()">
        <?= ($lojaAberta ? '🔴 Fechar Loja' : '🟢 Abrir Loja') ?>
    </button>
    
    <span id="statusLoja" class="status-loja <?= ($lojaAberta ? 'aberta' : 'fechada') ?>">
        <?= ($lojaAberta ? '🟢 Loja Aberta' : '🔴 Loja Fechada') ?>
    </span>
    
    <button id="btnSom" class="btn-som" onclick="toggleSom()">
        🔇 Som Desativado
    </button>
</div>

<h1>Pedidos</h1>

<?php if($lojaAberta): ?>
<div class="info-expediente">
    <strong>📅 Expediente Atual:</strong> Mostrando pedidos desde <?= date('d/m/Y H:i', strtotime($expedienteInicio)) ?>
</div>
<?php else: ?>
<div class="loja-fechada-banner">
    <h2>🔴 Loja Fechada</h2>
    <p>Os pedidos antigos não estão sendo exibidos. Clique em "Abrir Loja" para iniciar um novo expediente limpo.</p>
</div>
<?php endif; ?>

<div class="dashboard">

<div class="card-info">
<h2><?= $aguardando ?></h2>
<p>Aguardando Pagamento</p>
</div>

<div class="card-info">
<h2><?= $pagos ?></h2>
<p>Pagos</p>
</div>

<div class="card-info">
<h2><?= $preparo ?></h2>
<p>Em Preparo</p>
</div>

<div class="card-info">
<h2><?= $entregues ?></h2>
<p>Entregues</p>
</div>

<div class="card-info">
<h2>R$ <?= number_format($faturamento,2,',','.') ?></h2>
<p>Faturamento Hoje</p>
</div>

</div>

<div class="filtros">

<a href="pedidos.php">Todos</a>
<a href="?filtro=AGUARDANDO_PAGAMENTO">Aguardando</a>
<a href="?filtro=AGUARDANDO_PIX">Aguardando PIX</a>
<a href="?filtro=PAGO">Pago</a>
<a href="?filtro=EM_PREPARO">Preparo</a>
<a href="?filtro=PRONTO">Pronto</a>
<a href="?filtro=SAIU_ENTREGA">Entrega</a>
<a href="?filtro=ENTREGUE">Entregue</a>
<a href="?filtro=CONFIRMADO_CLIENTE">Confirmado Cliente</a>

</div>

<?php if($pedidos->num_rows == 0){ ?>

<div class="vazio">
<h2>🍢</h2>
<h3><?= $lojaAberta ? 'Aguardando novos pedidos' : 'Loja fechada' ?></h3>
<p><?= $lojaAberta ? 'Nenhum pedido encontrado desde a abertura deste expediente.' : 'Abra a loja para iniciar um novo expediente.' ?></p>
</div>

<?php }else{ ?>

<div class="pedidos-grid">

<?php while($pedido = $pedidos->fetch_assoc()){ 
    // Verificar se o pedido já foi aberto
    $pedidosAbertos = json_decode($_COOKIE['pedidosAbertos'] ?? '[]', true);
    $isNovo = !in_array($pedido['id'], $pedidosAbertos);
?>

<div class="pedido-card <?= $isNovo ? 'novo-pedido' : 'aberto' ?>" data-id="<?= $pedido['id'] ?>">

<h3>Pedido #<?= $pedido['id'] ?></h3>

<p><strong><?= $pedido['nome'] ?? 'Cliente não encontrado' ?></strong></p>
<p>📞 <?= $pedido['telefone'] ?></p>
<p>📍 <?= $pedido['bairro'] ?></p>
<p>💰 R$ <?= number_format($pedido['total'],2,',','.') ?></p>
<p>Origem: <?= $pedido['origem'] ?></p>

<span class="status <?= $pedido['status'] ?>">
<?= $pedido['status'] ?>
</span>

<div class="acoes">

<a class="btn ver" href="pedido_detalhes.php?id=<?= $pedido['id'] ?>">Ver Pedido</a>
<a class="btn pago" href="?id=<?= $pedido['id'] ?>&status=PAGO">Pago</a>
<a class="btn preparo" href="?id=<?= $pedido['id'] ?>&status=EM_PREPARO">Preparo</a>
<a class="btn pronto" href="?id=<?= $pedido['id'] ?>&status=PRONTO">Pronto</a>
<a class="btn entrega" href="?id=<?= $pedido['id'] ?>&status=SAIU_ENTREGA">Entrega</a>
<a class="btn entregue" href="?id=<?= $pedido['id'] ?>&status=ENTREGUE">Entregue</a>
<a class="btn cancelar" href="?id=<?= $pedido['id'] ?>&status=CANCELADO">Cancelar</a>

</div>

</div>

<?php } ?>

</div>

<?php } ?>

</div>

</div>

<script>
// Função adicional para garantir que os pedidos novos piscam
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se há pedidos com classe novo-pedido e iniciar temporizador
    document.querySelectorAll('.pedido-card.novo-pedido').forEach(card => {
        const id = card.dataset.id;
        if (id) {
            const abertos = JSON.parse(localStorage.getItem('pedidosAbertos') || '[]');
            if (!abertos.includes(parseInt(id))) {
                // Iniciar contagem de 30 segundos
                iniciarPiscarPedido(parseInt(id));
            }
        }
    });
});
</script>

</body>

</html>