<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';


$mensagemPainel = "";

if(isset($_SESSION['promo_msg'])){
    $mensagemPainel = $_SESSION['promo_msg'];
    unset($_SESSION['promo_msg']);
}

function h($valor){
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function montarUrlImagemPromocao($imagem){
    if(empty($imagem)){
        return '';
    }

    $protocolo = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $pastaAtual = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');

    if(empty($host)){
        return '';
    }

    return $protocolo . '://' . $host . $pastaAtual . '/uploads/' . rawurlencode($imagem);
}

function enviarJsonParaBot($url, $dados, &$erro = ''){
    $json = json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if($json === false){
        $erro = 'Erro ao montar JSON.';
        return null;
    }

    if(function_exists('curl_init')){
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json)
        ]);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $resposta = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErro = curl_error($ch);
        curl_close($ch);

        if($resposta === false){
            $erro = $curlErro ?: 'Falha ao conectar no bot.';
            return null;
        }

        $retorno = json_decode($resposta, true);

        if($httpCode < 200 || $httpCode >= 300){
            $erro = $retorno['erro'] ?? ('Bot retornou HTTP ' . $httpCode);
            return null;
        }

        return $retorno;
    }

    $contexto = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $json,
            'timeout' => 15
        ]
    ]);

    $resposta = @file_get_contents($url, false, $contexto);

    if($resposta === false){
        $erro = 'Falha ao conectar no bot.';
        return null;
    }

    return json_decode($resposta, true);
}

if(isset($_POST['enviar_promocao_clientes'])){

    $id = intval($_POST['promocao_id'] ?? 0);

    $promoRes = $conn->query("
    SELECT
        pr.*,
        p.nome AS produto
    FROM promocoes pr
    LEFT JOIN produtos p ON p.id = pr.produto_id
    WHERE pr.id = '$id'
    LIMIT 1
    ");

    if(!$promoRes || !$promoRes->num_rows){
        $_SESSION['promo_msg'] = 'Promoção não encontrada.';
        header("Location: promocoes.php");
        exit;
    }

    $promo = $promoRes->fetch_assoc();

    $clientesRes = $conn->query("
    SELECT id, nome, telefone
    FROM clientes
    WHERE telefone IS NOT NULL
    AND TRIM(telefone) <> ''
    AND TRIM(telefone) <> '-'
    ORDER BY id ASC
    ");

    $clientes = [];

    if($clientesRes){
        while($cliente = $clientesRes->fetch_assoc()){
            $clientes[] = [
                'id' => (int)$cliente['id'],
                'nome' => $cliente['nome'],
                'telefone' => $cliente['telefone']
            ];
        }
    }

    if(!count($clientes)){
        $_SESSION['promo_msg'] = 'Nenhum cliente com telefone cadastrado para receber a promoção.';
        header("Location: promocoes.php");
        exit;
    }

    $payload = [
        'promocao' => [
            'id' => (int)$promo['id'],
            'titulo' => $promo['titulo'],
            'descricao' => $promo['descricao'],
            'produto' => $promo['produto'] ?: 'Geral',
            'preco_promocional' => (float)$promo['preco_promocional'],
            'data_inicio' => $promo['data_inicio'],
            'data_fim' => $promo['data_fim'],
            'imagem' => $promo['imagem'],
            'imagem_url' => montarUrlImagemPromocao($promo['imagem'])
        ],
        'clientes' => $clientes
    ];

    $erroBot = '';
    $retornoBot = enviarJsonParaBot('http://127.0.0.1:4000/enviar-promocao-clientes', $payload, $erroBot);

    if($retornoBot && !empty($retornoBot['sucesso'])){
        $total = intval($retornoBot['total_clientes'] ?? count($clientes));
        $_SESSION['promo_msg'] = 'Envio iniciado pelo bot para ' . $total . ' cliente(s). Aguarde alguns minutos se houver muitos contatos.';
    }else{
        $_SESSION['promo_msg'] = 'Não consegui acionar o bot para enviar a promoção. Erro: ' . ($erroBot ?: 'sem resposta do bot');
    }

    header("Location: promocoes.php");
    exit;
}


if(isset($_POST['salvar'])){

    $titulo = $conn->real_escape_string($_POST['titulo']);
    $descricao = $conn->real_escape_string($_POST['descricao']);
    $produto_id = !empty($_POST['produto_id']) ? intval($_POST['produto_id']) : "NULL";
    $preco_promocional = $conn->real_escape_string($_POST['preco_promocional']);
    $data_inicio = $_POST['data_inicio'];
    $data_fim = $_POST['data_fim'];
    $ativo = isset($_POST['ativo']) ? 1 : 0;

    $imagem = "";

    if(isset($_FILES['imagem']) && $_FILES['imagem']['error'] == 0){

        $pasta = "uploads/";

        if(!is_dir($pasta)){
            mkdir($pasta, 0777, true);
        }

        $ext = strtolower(pathinfo($_FILES['imagem']['name'], PATHINFO_EXTENSION));
        $permitidas = ['jpg','jpeg','png','webp'];

        if(in_array($ext, $permitidas)){
            $imagem = "promocao_" . time() . "." . $ext;

            move_uploaded_file(
                $_FILES['imagem']['tmp_name'],
                $pasta . $imagem
            );
        }
    }

    $conn->query("
    INSERT INTO promocoes
    (
        titulo,
        descricao,
        imagem,
        produto_id,
        preco_promocional,
        data_inicio,
        data_fim,
        ativo
    )
    VALUES
    (
        '$titulo',
        '$descricao',
        '$imagem',
        $produto_id,
        '$preco_promocional',
        '$data_inicio',
        '$data_fim',
        '$ativo'
    )
    ");

    header("Location: promocoes.php");
    exit;
}

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){
        $conn->query("UPDATE promocoes SET ativo=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'desativar'){
        $conn->query("UPDATE promocoes SET ativo=0 WHERE id='$id'");
    }

    header("Location: promocoes.php");
    exit;
}

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $conn->query("
    DELETE FROM promocoes
    WHERE id='$id'
    ");

    header("Location: promocoes.php");
    exit;
}

$produtos = $conn->query("
SELECT id, nome
FROM produtos
WHERE ativo=1
ORDER BY nome ASC
");

$promocoes = $conn->query("
SELECT
pr.*,
p.nome AS produto

FROM promocoes pr

LEFT JOIN produtos p
ON p.id = pr.produto_id

ORDER BY pr.id DESC
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Promoções</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>
.form-card,
.table-box{
    background:#fff;
    padding:25px;
    border-radius:15px;
    margin-bottom:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.form-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:15px;
}

.form-group{
    margin-bottom:15px;
}

.form-group label{
    display:block;
    margin-bottom:5px;
    font-weight:bold;
}

.form-group input,
.form-group textarea,
.form-group select{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.badge-ativo{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-inativo{
    background:#f8d7da;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.promo-img{
    width:80px;
    height:60px;
    object-fit:cover;
    border-radius:8px;
}

.acoes a{
    text-decoration:none;
    margin-right:8px;
}

.alerta-painel{
    background:#fff3cd;
    color:#664d03;
    border:1px solid #ffecb5;
    padding:14px 18px;
    border-radius:10px;
    margin-bottom:20px;
    font-weight:bold;
}

.btn-enviar-whats{
    background:#25d366;
    color:#fff;
    border:none;
    padding:7px 10px;
    border-radius:7px;
    cursor:pointer;
    margin-top:8px;
    font-size:13px;
}

.acoes form{
    display:inline-block;
    margin-top:8px;
}

</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">
Promoções
</h1>

<?php if(!empty($mensagemPainel)){ ?>
<div class="alerta-painel">
<?= h($mensagemPainel); ?>
</div>
<?php } ?>

<div class="form-card">

<h2>Nova Promoção</h2>

<br>

<form method="POST" enctype="multipart/form-data">

<div class="form-group">
<label>Título</label>
<input type="text" name="titulo" required placeholder="Ex: Promoção da Semana">
</div>

<div class="form-group">
<label>Descrição</label>
<textarea name="descricao" rows="4" placeholder="Descrição da promoção"></textarea>
</div>

<div class="form-grid">

<div class="form-group">
<label>Produto Vinculado</label>

<select name="produto_id">

<option value="">
Nenhum produto específico
</option>

<?php while($produto = $produtos->fetch_assoc()){ ?>

<option value="<?= $produto['id']; ?>">
<?= $produto['nome']; ?>
</option>

<?php } ?>

</select>
</div>

<div class="form-group">
<label>Preço Promocional</label>
<input type="number" step="0.01" name="preco_promocional" value="0.00">
</div>

<div class="form-group">
<label>Data Início</label>
<input type="date" name="data_inicio">
</div>

<div class="form-group">
<label>Data Fim</label>
<input type="date" name="data_fim">
</div>

</div>

<div class="form-group">
<label>Imagem / Banner</label>
<input type="file" name="imagem" accept="image/*">
</div>

<label>
<input type="checkbox" name="ativo" checked>
Promoção Ativa
</label>

<br><br>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Promoção
</button>

</form>

</div>

<div class="table-box">

<h2>Promoções Cadastradas</h2>

<br>

<table>

<tr>
<th>ID</th>
<th>Imagem</th>
<th>Título</th>
<th>Produto</th>
<th>Preço Promo</th>
<th>Período</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($promo = $promocoes->fetch_assoc()){ ?>

<tr>

<td><?= $promo['id']; ?></td>

<td>
<?php if(!empty($promo['imagem'])){ ?>

<img src="uploads/<?= $promo['imagem']; ?>" class="promo-img">

<?php }else{ ?>

Sem imagem

<?php } ?>
</td>

<td>
<strong><?= $promo['titulo']; ?></strong>
<br>
<small><?= $promo['descricao']; ?></small>
</td>

<td>
<?= $promo['produto'] ?? 'Geral'; ?>
</td>

<td>
R$ <?= number_format($promo['preco_promocional'],2,',','.'); ?>
</td>

<td>
<?= $promo['data_inicio']; ?>
<br>
até
<br>
<?= $promo['data_fim']; ?>
</td>

<td>
<?php if($promo['ativo']){ ?>
<span class="badge-ativo">Ativa</span>
<?php }else{ ?>
<span class="badge-inativo">Inativa</span>
<?php } ?>
</td>

<td class="acoes">

<?php if($promo['ativo']){ ?>

<a href="?acao=desativar&id=<?= $promo['id']; ?>" style="color:red;">
Desativar
</a>

<?php }else{ ?>

<a href="?acao=ativar&id=<?= $promo['id']; ?>" style="color:green;">
Ativar
</a>

<?php } ?>

<a
href="?excluir=<?= $promo['id']; ?>"
style="color:red;"
onclick="return confirm('Excluir esta promoção?')">

Excluir

</a>

<br>

<form method="POST" onsubmit="return confirm('Enviar esta promoção para todos os clientes cadastrados com WhatsApp?');">
<input type="hidden" name="promocao_id" value="<?= (int)$promo['id']; ?>">
<button type="submit" name="enviar_promocao_clientes" class="btn-enviar-whats">
📲 Enviar promoção para clientes
</button>
</form>

</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>
</html>