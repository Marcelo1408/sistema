<?php
session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function h($valor){
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function tabelaExiste($conn, $tabela){
    $tabela = str_replace('`', '', (string)$tabela);
    $safe = $conn->real_escape_string($tabela);
    $res = $conn->query("SHOW TABLES LIKE '$safe'");
    return $res && $res->num_rows > 0;
}

function colunaExiste($conn, $tabela, $coluna){
    $tabela = str_replace('`', '', (string)$tabela);
    $safeColuna = $conn->real_escape_string($coluna);
    $res = $conn->query("SHOW COLUMNS FROM `$tabela` LIKE '$safeColuna'");
    return $res && $res->num_rows > 0;
}

function senhaConfere($senhaDigitada, $senhaBanco){
    $senhaDigitada = (string)$senhaDigitada;
    $senhaBanco = (string)$senhaBanco;

    if($senhaDigitada === '' || $senhaBanco === ''){
        return false;
    }

    if(password_verify($senhaDigitada, $senhaBanco)){
        return true;
    }

    if(strlen($senhaBanco) === 32 && hash_equals(strtolower($senhaBanco), md5($senhaDigitada))){
        return true;
    }

    return hash_equals($senhaBanco, $senhaDigitada);
}

function idsAdminSessao(){
    $chaves = [
        'admin_id',
        'id_admin',
        'adm_id',
        'usuario_id',
        'user_id',
        'id_usuario',
        'id'
    ];

    $ids = [];

    foreach($chaves as $chave){
        if(isset($_SESSION[$chave]) && intval($_SESSION[$chave]) > 0){
            $ids[] = intval($_SESSION[$chave]);
        }
    }

    return array_values(array_unique($ids));
}

function senhaAdministradorValida($conn, $senhaDigitada){
    $senhaDigitada = trim((string)$senhaDigitada);

    if($senhaDigitada === ''){
        return false;
    }

    $tabelas = [
        'usuarios_sistema',
        'administradores',
        'admins',
        'admin',
        'usuarios',
        'users'
    ];

    $colunasSenha = [
        'senha',
        'password',
        'senha_hash',
        'password_hash'
    ];

    $idsSessao = idsAdminSessao();

    /*
     * Primeiro tenta validar usando o ID do administrador logado na sessão.
     * Isso evita aceitar senha de outro usuário comum.
     */
    if(!empty($idsSessao)){
        foreach($tabelas as $tabela){
            if(!tabelaExiste($conn, $tabela) || !colunaExiste($conn, $tabela, 'id')){
                continue;
            }

            foreach($colunasSenha as $colunaSenha){
                if(!colunaExiste($conn, $tabela, $colunaSenha)){
                    continue;
                }

                foreach($idsSessao as $idAdmin){
                    if(colunaExiste($conn, $tabela, 'nivel')){
                        $sql = "SELECT `$colunaSenha` AS senha_admin FROM `$tabela` WHERE id = ? AND nivel = 'ADM' LIMIT 1";
                    } else {
                        $sql = "SELECT `$colunaSenha` AS senha_admin FROM `$tabela` WHERE id = ? LIMIT 1";
                    }
                    $stmt = $conn->prepare($sql);

                    if(!$stmt){
                        continue;
                    }

                    $stmt->bind_param('i', $idAdmin);
                    $stmt->execute();
                    $res = $stmt->get_result();

                    if($res && $res->num_rows){
                        $row = $res->fetch_assoc();

                        if(senhaConfere($senhaDigitada, $row['senha_admin'] ?? '')){
                            $stmt->close();
                            return true;
                        }
                    }

                    $stmt->close();
                }
            }
        }
    }

    /*
     * Plano B: se o sistema antigo não grava ID do admin na sessão,
     * aceita senha existente somente nas tabelas de administradores.
     */
    foreach(['usuarios_sistema', 'administradores', 'admins', 'admin'] as $tabela){
        if(!tabelaExiste($conn, $tabela)){
            continue;
        }

        foreach($colunasSenha as $colunaSenha){
            if(!colunaExiste($conn, $tabela, $colunaSenha)){
                continue;
            }

            if(colunaExiste($conn, $tabela, 'nivel')){
                $sql = "SELECT `$colunaSenha` AS senha_admin FROM `$tabela` WHERE nivel = 'ADM' LIMIT 100";
            } else {
                $sql = "SELECT `$colunaSenha` AS senha_admin FROM `$tabela` LIMIT 100";
            }

            $res = $conn->query($sql);

            if($res){
                while($row = $res->fetch_assoc()){
                    if(senhaConfere($senhaDigitada, $row['senha_admin'] ?? '')){
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

function desassociarPedidosDoCliente($conn, $clienteId){
    if(tabelaExiste($conn, 'pedidos') && colunaExiste($conn, 'pedidos', 'cliente_id')){
        $stmt = $conn->prepare("UPDATE pedidos SET cliente_id = NULL WHERE cliente_id = ?");

        if($stmt){
            $stmt->bind_param('i', $clienteId);
            $stmt->execute();
            $stmt->close();
        }
    }
}

function desassociarTodosPedidos($conn){
    if(tabelaExiste($conn, 'pedidos') && colunaExiste($conn, 'pedidos', 'cliente_id')){
        $conn->query("UPDATE pedidos SET cliente_id = NULL WHERE cliente_id IS NOT NULL");
    }
}

if(empty($_SESSION['csrf_clientes'])){
    $_SESSION['csrf_clientes'] = bin2hex(random_bytes(32));
}

$mensagemSucesso = '';
$mensagemErro = '';

/*
|--------------------------------------------------------------------------
| EXCLUIR CLIENTE / LIMPAR CLIENTES
|--------------------------------------------------------------------------
*/

if($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['acao'])){
    $csrfRecebido = $_POST['csrf_token'] ?? '';

    if(!hash_equals($_SESSION['csrf_clientes'], $csrfRecebido)){
        $mensagemErro = 'Falha de segurança. Atualize a página e tente novamente.';
    } else {
        $senhaAdmin = $_POST['senha_admin'] ?? '';

        if(!senhaAdministradorValida($conn, $senhaAdmin)){
            $mensagemErro = 'Senha do administrador inválida. Use a mesma senha que você usa para entrar no painel.';
        } else {
            $acao = $_POST['acao'];

            if($acao === 'excluir_cliente'){
                $clienteId = intval($_POST['cliente_id'] ?? 0);

                if($clienteId <= 0){
                    $mensagemErro = 'Cliente inválido.';
                } else {
                    desassociarPedidosDoCliente($conn, $clienteId);

                    $stmt = $conn->prepare("DELETE FROM clientes WHERE id = ? LIMIT 1");

                    if(!$stmt){
                        $mensagemErro = 'Erro ao preparar exclusão do cliente.';
                    } else {
                        $stmt->bind_param('i', $clienteId);
                        $stmt->execute();

                        if($stmt->affected_rows > 0){
                            $mensagemSucesso = 'Cliente excluído com sucesso.';
                        } else {
                            $mensagemErro = 'Cliente não encontrado ou já excluído.';
                        }

                        $stmt->close();
                    }
                }
            }

            if($acao === 'limpar_clientes'){
                $confirmacao = strtoupper(trim((string)($_POST['confirmacao_limpar'] ?? '')));

                if($confirmacao !== 'LIMPAR'){
                    $mensagemErro = 'Para limpar todos os clientes, digite LIMPAR na confirmação.';
                } else {
                    desassociarTodosPedidos($conn);

                    if($conn->query("DELETE FROM clientes")){
                        $conn->query("ALTER TABLE clientes AUTO_INCREMENT = 1");
                        $mensagemSucesso = 'Todos os clientes foram excluídos com sucesso.';
                    } else {
                        $mensagemErro = 'Erro ao limpar clientes: ' . $conn->error;
                    }
                }
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| PESQUISA
|--------------------------------------------------------------------------
*/

$where = "";
$buscaAtual = "";

if(isset($_GET['busca']) && trim($_GET['busca']) !== ''){
    $buscaAtual = trim($_GET['busca']);
    $busca = $conn->real_escape_string($buscaAtual);

    $where = "
    WHERE nome LIKE '%$busca%'
    OR telefone LIKE '%$busca%'
    ";
}

/*
|--------------------------------------------------------------------------
| DASHBOARD
|--------------------------------------------------------------------------
*/

$totalClientes = $conn->query("
SELECT COUNT(*) total
FROM clientes
")->fetch_assoc()['total'];

$totalGasto = $conn->query("
SELECT COALESCE(SUM(valor_gasto),0) total
FROM clientes
")->fetch_assoc()['total'];

$melhorCliente = $conn->query("
SELECT nome, valor_gasto
FROM clientes
ORDER BY valor_gasto DESC
LIMIT 1
");

$melhorCliente = $melhorCliente->num_rows
? $melhorCliente->fetch_assoc()
: null;

/*
|--------------------------------------------------------------------------
| CLIENTES
|--------------------------------------------------------------------------
*/

$clientes = $conn->query("
SELECT *
FROM clientes
$where
ORDER BY id DESC
");
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Clientes</title>

<link rel="stylesheet" href="assets/css/style.css">

<style>
.dashboard{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:20px;
margin-bottom:25px;
}

.card-info{
background:#fff;
padding:20px;
border-radius:15px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
}

.card-info h2{
margin-top:10px;
color:#ff6b00;
}

.busca-box{
background:#fff;
padding:20px;
border-radius:15px;
margin-bottom:20px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
}

.busca-box form{
display:flex;
gap:10px;
flex-wrap:wrap;
}

.busca-box input{
flex:1;
min-width:220px;
padding:10px;
border:1px solid #ddd;
border-radius:8px;
}

.btn-busca{
background:#ff6b00;
color:#fff;
border:none;
padding:10px 20px;
border-radius:8px;
cursor:pointer;
}

.table-box{
background:#fff;
border-radius:15px;
padding:20px;
box-shadow:0 3px 12px rgba(0,0,0,.08);
overflow-x:auto;
}

.badge{
padding:5px 10px;
border-radius:20px;
background:#d4edda;
font-size:12px;
}

.acoes{
display:flex;
gap:8px;
align-items:center;
flex-wrap:wrap;
}

.acoes a{
text-decoration:none;
}

.form-excluir{
display:inline;
margin:0;
}

.btn-excluir{
border:0;
background:transparent;
color:red;
cursor:pointer;
font-size:15px;
padding:0;
}

.alerta-sucesso,
.alerta-erro{
padding:12px 15px;
border-radius:10px;
margin-bottom:15px;
font-weight:bold;
}

.alerta-sucesso{
background:#d1e7dd;
color:#0f5132;
}

.alerta-erro{
background:#f8d7da;
color:#842029;
}

.limpar-box{
background:#fff3cd;
border:1px solid #ffe69c;
padding:15px;
border-radius:12px;
margin-bottom:20px;
}

.limpar-box strong{
display:block;
margin-bottom:8px;
color:#664d03;
}

.btn-limpar{
background:#dc3545;
color:#fff;
border:none;
padding:10px 15px;
border-radius:8px;
cursor:pointer;
}
</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Clientes</h1>

<?php if($mensagemSucesso){ ?>
<div class="alerta-sucesso"><?= h($mensagemSucesso); ?></div>
<?php } ?>

<?php if($mensagemErro){ ?>
<div class="alerta-erro"><?= h($mensagemErro); ?></div>
<?php } ?>

<div class="dashboard">

<div class="card-info">
<h4>Total de Clientes</h4>
<h2><?= h($totalClientes); ?></h2>
</div>

<div class="card-info">
<h4>Total Gasto</h4>
<h2>R$ <?= number_format((float)$totalGasto,2,',','.'); ?></h2>
</div>

<div class="card-info">
<h4>Melhor Cliente</h4>

<?php if($melhorCliente){ ?>

<h2><?= h($melhorCliente['nome']); ?></h2>

<p>
R$ <?= number_format((float)$melhorCliente['valor_gasto'],2,',','.'); ?>
</p>

<?php }else{ ?>

<h2>---</h2>

<?php } ?>

</div>

</div>

<div class="busca-box">

<form method="GET">

<input
type="text"
name="busca"
value="<?= h($buscaAtual); ?>"
placeholder="Buscar por nome ou telefone">

<button class="btn-busca">
Pesquisar
</button>

</form>

</div>

<div class="limpar-box">
<strong>Limpeza do sistema</strong>
<p>Use apenas se quiser apagar todos os clientes cadastrados. Para evitar erro, será solicitada a senha do administrador e a palavra LIMPAR.</p>

<form method="POST" onsubmit="return confirmarLimparClientes(this);">
<input type="hidden" name="csrf_token" value="<?= h($_SESSION['csrf_clientes']); ?>">
<input type="hidden" name="acao" value="limpar_clientes">
<input type="hidden" name="senha_admin" value="">
<input type="hidden" name="confirmacao_limpar" value="">

<button type="submit" class="btn-limpar">
🧹 Limpar todos os clientes
</button>
</form>
</div>

<div class="table-box">

<table>

<tr>
<th>ID</th>
<th>Nome</th>
<th>Telefone</th>
<th>Bairro</th>
<th>Pedidos</th>
<th>Valor Gasto</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($cliente = $clientes->fetch_assoc()){ ?>

<tr>

<td><?= h($cliente['id']); ?></td>

<td><?= h($cliente['nome']); ?></td>

<td><?= h($cliente['telefone']); ?></td>

<td><?= h($cliente['bairro']); ?></td>

<td><?= h($cliente['total_pedidos']); ?></td>

<td>
R$
<?= number_format((float)$cliente['valor_gasto'], 2, ',', '.'); ?>
</td>

<td>
<span class="badge">
Cliente
</span>
</td>

<td class="acoes">

<a href="cliente_detalhes.php?id=<?= h($cliente['id']); ?>">
👁 Ver
</a>

<a href="editar_cliente.php?id=<?= h($cliente['id']); ?>">
✏ Editar
</a>

<form method="POST" class="form-excluir" onsubmit='return confirmarExcluirCliente(this, <?= json_encode((string)$cliente['nome'], JSON_UNESCAPED_UNICODE); ?>);'>
<input type="hidden" name="csrf_token" value="<?= h($_SESSION['csrf_clientes']); ?>">
<input type="hidden" name="acao" value="excluir_cliente">
<input type="hidden" name="cliente_id" value="<?= h($cliente['id']); ?>">
<input type="hidden" name="senha_admin" value="">

<button type="submit" class="btn-excluir">
🗑 Excluir
</button>
</form>

</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

<script>
function confirmarExcluirCliente(form, nomeCliente){
    if(!confirm('Deseja realmente excluir o cliente "' + nomeCliente + '"?')){
        return false;
    }

    const senha = prompt('Digite a senha do administrador para confirmar a exclusao:');

    if(!senha){
        alert('Exclusao cancelada. Senha nao informada.');
        return false;
    }

    form.querySelector('input[name="senha_admin"]').value = senha;
    return true;
}

function confirmarLimparClientes(form){
    if(!confirm('ATENCAO: isso vai excluir TODOS os clientes cadastrados. Deseja continuar?')){
        return false;
    }

    const texto = prompt('Para confirmar, digite exatamente: LIMPAR');

    if(texto !== 'LIMPAR'){
        alert('Limpeza cancelada. Confirmacao incorreta.');
        return false;
    }

    const senha = prompt('Digite a senha do administrador para confirmar a limpeza:');

    if(!senha){
        alert('Limpeza cancelada. Senha nao informada.');
        return false;
    }

    form.querySelector('input[name="confirmacao_limpar"]').value = texto;
    form.querySelector('input[name="senha_admin"]').value = senha;

    return true;
}
</script>

</body>

</html>
