<?php
session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function h($valor){
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function coluna_produto_existe($conn, $coluna){
    $coluna = $conn->real_escape_string($coluna);
    $res = $conn->query("SHOW COLUMNS FROM produtos LIKE '$coluna'");
    return $res && $res->num_rows > 0;
}

function garantir_coluna_ordem_produtos($conn){
    if(!coluna_produto_existe($conn, 'ordem')){
        $conn->query("ALTER TABLE produtos ADD COLUMN ordem INT NOT NULL DEFAULT 0");
    }
}

function normalizar_ordem_produtos($conn){
    garantir_coluna_ordem_produtos($conn);

    $res = $conn->query("
        SELECT id, ordem
        FROM produtos
        ORDER BY
            CASE WHEN IFNULL(ordem,0) <= 0 THEN 1 ELSE 0 END ASC,
            ordem ASC,
            id ASC
    ");

    $posicao = 1;
    while($row = $res->fetch_assoc()){
        $id = (int)$row['id'];
        $ordemAtual = (int)$row['ordem'];

        if($ordemAtual !== $posicao){
            $conn->query("UPDATE produtos SET ordem = $posicao WHERE id = $id");
        }

        $posicao++;
    }
}

function total_produtos($conn){
    $res = $conn->query("SELECT COUNT(*) total FROM produtos");
    $row = $res->fetch_assoc();
    return (int)($row['total'] ?? 0);
}

function ajustar_posicao_produto($conn, $produtoId, $ordemAtual, $novaOrdem){
    $produtoId = (int)$produtoId;
    $ordemAtual = (int)$ordemAtual;
    $novaOrdem = (int)$novaOrdem;

    if($novaOrdem === $ordemAtual) return;

    if($novaOrdem < $ordemAtual){
        $conn->query("
            UPDATE produtos
            SET ordem = ordem + 1
            WHERE ordem >= $novaOrdem
            AND ordem < $ordemAtual
            AND id <> $produtoId
        ");
    }else{
        $conn->query("
            UPDATE produtos
            SET ordem = ordem - 1
            WHERE ordem <= $novaOrdem
            AND ordem > $ordemAtual
            AND id <> $produtoId
        ");
    }
}

$id = intval($_GET['id'] ?? 0);
if($id <= 0){
    die('Produto inválido.');
}

normalizar_ordem_produtos($conn);

$produtoAtual = $conn->query("SELECT * FROM produtos WHERE id='$id'")->fetch_assoc();
if(!$produtoAtual){
    die('Produto não encontrado.');
}

if(isset($_POST['salvar'])){

    $categoria = (int)($_POST['categoria'] ?? 0);
    $nome = $conn->real_escape_string(trim((string)($_POST['nome'] ?? '')));
    $descricao = $conn->real_escape_string(trim((string)($_POST['descricao'] ?? '')));
    $preco = (float)str_replace(',', '.', (string)($_POST['preco'] ?? 0));
    $estoque = (int)($_POST['estoque'] ?? 0);
    $ativo = isset($_POST['ativo']) ? 1 : 0;
    $destaque = isset($_POST['destaque']) ? 1 : 0;

    $ordemAtual = (int)$produtoAtual['ordem'];
    $maxOrdem = max(1, total_produtos($conn));
    $novaOrdem = (int)($_POST['ordem'] ?? $ordemAtual);

    if($novaOrdem <= 0) $novaOrdem = $ordemAtual;
    if($novaOrdem > $maxOrdem) $novaOrdem = $maxOrdem;

    ajustar_posicao_produto($conn, $id, $ordemAtual, $novaOrdem);

    $sqlImagem = "";

    if(isset($_FILES['imagem']) && $_FILES['imagem']['error'] == 0){

        $nomeArquivo = basename($_FILES['imagem']['name']);
        $nomeArquivo = preg_replace('/[^a-zA-Z0-9._-]/', '_', $nomeArquivo);
        $arquivo = time().'_'.$nomeArquivo;

        move_uploaded_file(
            $_FILES['imagem']['tmp_name'],
            'uploads/'.$arquivo
        );

        $arquivo = $conn->real_escape_string($arquivo);
        $sqlImagem = ", imagem='$arquivo'";
    }

    $conn->query("
    UPDATE produtos SET
        categoria_id='$categoria',
        nome='$nome',
        descricao='$descricao',
        preco='$preco',
        estoque='$estoque',
        ativo='$ativo',
        destaque='$destaque',
        ordem='$novaOrdem'
        $sqlImagem
    WHERE id='$id'
    ");

    normalizar_ordem_produtos($conn);

    header("Location: produtos.php");
    exit;
}

$produto = $conn->query("SELECT * FROM produtos WHERE id='$id'")->fetch_assoc();

$categorias = $conn->query("
SELECT *
FROM categorias
WHERE ativo=1
ORDER BY nome
");
?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Editar Produto</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>
.form-box{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}
.form-box input,
.form-box textarea,
.form-box select{
    width:100%;
    padding:12px;
    margin-bottom:12px;
    border:1px solid #ddd;
    border-radius:8px;
}
.form-help{
    display:block;
    margin:-6px 0 12px;
    color:#666;
    font-size:13px;
}
.btn-salvar{
    background:#ff6b00;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}
.preview{
    width:250px;
    border-radius:10px;
    margin-bottom:15px;
}
</style>
</head>

<body>
<?php include 'includes/sidebar.php'; ?>

<div class="main">
<?php include 'includes/topbar.php'; ?>

<div class="content">
<div class="form-box">

<h2>✏️ Editar Produto</h2>

<form method="POST" enctype="multipart/form-data">

<label>Categoria</label>
<select name="categoria">
<?php while($cat = $categorias->fetch_assoc()){ ?>
<option value="<?=h($cat['id'])?>" <?=$produto['categoria_id']==$cat['id'] ? 'selected' : ''?>>
<?=h($cat['nome'])?>
</option>
<?php } ?>
</select>

<label>Nome</label>
<input type="text" name="nome" value="<?=h($produto['nome'])?>">

<label>Descrição</label>
<textarea name="descricao" rows="4"><?=h($produto['descricao'])?></textarea>

<label>Preço</label>
<input type="number" step="0.01" name="preco" value="<?=h($produto['preco'])?>">

<label>Estoque</label>
<input type="number" name="estoque" value="<?=h($produto['estoque'])?>">

<label>Posição no cardápio</label>
<input type="number" name="ordem" min="1" max="<?=h(total_produtos($conn))?>" value="<?=h($produto['ordem'])?>">
<small class="form-help">
    Use 1 para aparecer primeiro. Os outros produtos serão reorganizados automaticamente.
</small>

<?php if(!empty($produto['imagem'])){ ?>
<label>Imagem Atual</label><br>
<img src="uploads/<?=h($produto['imagem'])?>" class="preview" alt="<?=h($produto['nome'])?>"><br>
<?php } ?>

<label>Nova Imagem</label>
<input type="file" name="imagem">

<label>
<input type="checkbox" name="ativo" <?=$produto['ativo'] ? 'checked' : ''?>>
Produto Ativo
</label>

<br><br>

<label>
<input type="checkbox" name="destaque" <?=$produto['destaque'] ? 'checked' : ''?>>
Produto Destaque
</label>

<br><br>

<button class="btn-salvar" name="salvar">Salvar Alterações</button>

<a href="produtos.php" style="margin-left:10px;text-decoration:none;">Cancelar</a>

</form>

</div>
</div>
</div>
</body>
</html>
