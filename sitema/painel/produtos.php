<?php
session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

/*
|--------------------------------------------------------------------------
| FUNÇÕES DE ORDEM DO CARDÁPIO
|--------------------------------------------------------------------------
*/

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

function proxima_ordem_produto($conn){
    garantir_coluna_ordem_produtos($conn);
    $res = $conn->query("SELECT COUNT(*) total FROM produtos");
    $row = $res->fetch_assoc();
    return ((int)($row['total'] ?? 0)) + 1;
}

function abrir_posicao_produto($conn, $ordem){
    $ordem = max(1, (int)$ordem);
    $conn->query("UPDATE produtos SET ordem = ordem + 1 WHERE ordem >= $ordem");
}

normalizar_ordem_produtos($conn);

/*
|--------------------------------------------------------------------------
| SALVAR PRODUTO
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $categoria = (int)($_POST['categoria'] ?? 0);
    $nome = $conn->real_escape_string(trim((string)($_POST['nome'] ?? '')));
    $descricao = $conn->real_escape_string(trim((string)($_POST['descricao'] ?? '')));
    $preco = (float)str_replace(',', '.', (string)($_POST['preco'] ?? 0));
    $estoque = (int)($_POST['estoque'] ?? 0);
    $ativo = isset($_POST['ativo']) ? 1 : 0;
    $destaque = isset($_POST['destaque']) ? 1 : 0;

    $proximaOrdem = proxima_ordem_produto($conn);
    $ordem = (int)($_POST['ordem'] ?? $proximaOrdem);

    if($ordem <= 0) $ordem = $proximaOrdem;
    if($ordem > $proximaOrdem) $ordem = $proximaOrdem;

    $imagem = '';

    if(isset($_FILES['imagem']) && $_FILES['imagem']['error'] == 0){

        $nomeArquivo = basename($_FILES['imagem']['name']);
        $nomeArquivo = preg_replace('/[^a-zA-Z0-9._-]/', '_', $nomeArquivo);
        $arquivo = time().'_'.$nomeArquivo;

        move_uploaded_file(
            $_FILES['imagem']['tmp_name'],
            'uploads/'.$arquivo
        );

        $imagem = $conn->real_escape_string($arquivo);
    }

    abrir_posicao_produto($conn, $ordem);

    $sql = "
    INSERT INTO produtos
    (
        categoria_id,
        nome,
        descricao,
        preco,
        imagem,
        ativo,
        destaque,
        estoque,
        ordem
    )
    VALUES
    (
        '$categoria',
        '$nome',
        '$descricao',
        '$preco',
        '$imagem',
        '$ativo',
        '$destaque',
        '$estoque',
        '$ordem'
    )
    ";

    $conn->query($sql);
    normalizar_ordem_produtos($conn);

    header("Location: produtos.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| EXCLUIR PRODUTO
|--------------------------------------------------------------------------
*/

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $conn->query("DELETE FROM produtos WHERE id = $id");
    normalizar_ordem_produtos($conn);

    header("Location: produtos.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| CONSULTAS
|--------------------------------------------------------------------------
*/

$proximaOrdemCadastro = proxima_ordem_produto($conn);

$categorias = $conn->query(
"SELECT * FROM categorias
WHERE ativo = 1
ORDER BY nome"
);

$produtos = $conn->query(
"
SELECT
p.*,
c.nome AS categoria
FROM produtos p
LEFT JOIN categorias c
ON c.id = p.categoria_id
ORDER BY p.ordem ASC, p.id ASC
"
);

?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Produtos</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">

<style>
.form-box{
    background:#fff;
    padding:20px;
    border-radius:15px;
    margin-bottom:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.05);
}
.form-box h2{ margin-bottom:15px; }
.form-box input,
.form-box textarea,
.form-box select{
    width:100%;
    padding:12px;
    margin-bottom:10px;
    border:1px solid #ddd;
    border-radius:8px;
}
.form-help{
    display:block;
    margin:-4px 0 12px;
    color:#666;
    font-size:13px;
}
.produtos-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
    gap:20px;
}
.produto-card{
    background:#fff;
    border-radius:15px;
    overflow:hidden;
    box-shadow:0 4px 15px rgba(0,0,0,.08);
}
.produto-card img{
    width:100%;
    height:220px;
    object-fit:cover;
}
.produto-body{ padding:15px; }
.produto-nome{
    font-size:20px;
    font-weight:bold;
    margin-bottom:10px;
}
.produto-preco{
    color:#ff6b00;
    font-size:24px;
    font-weight:bold;
    margin-top:10px;
}
.badge{
    display:inline-block;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
    margin-top:10px;
    margin-right:5px;
}
.ativo{ background:#d4edda; }
.inativo{ background:#f8d7da; }
.destaque{ background:#fff3cd; }
.ordem{ background:#e7f1ff; color:#084298; font-weight:bold; }
.acoes{
    margin-top:15px;
    display:flex;
    gap:8px;
    flex-wrap:wrap;
}
.btn-excluir,
.btn-editar,
.btn-adicionais{
    color:#fff;
    text-decoration:none;
    padding:8px 12px;
    border-radius:5px;
    display:inline-block;
}
.btn-excluir{ background:#dc3545; }
.btn-editar{ background:#0d6efd; }
.btn-adicionais{ background:#6f42c1; }
.btn-salvar{
    background:#ff6b00;
    color:#fff;
    border:none;
    padding:12px 20px;
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

<div class="form-box">
<h2>🍢 Novo Produto</h2>

<form method="POST" enctype="multipart/form-data">

<label>Categoria</label>
<select name="categoria" required>
<option value="">Selecione a categoria</option>
<?php while($cat = $categorias->fetch_assoc()){ ?>
<option value="<?=h($cat['id'])?>"><?=h($cat['nome'])?></option>
<?php } ?>
</select>

<label>Nome do Produto</label>
<input type="text" name="nome" placeholder="Nome do Produto" required>

<label>Descrição</label>
<textarea name="descricao" placeholder="Descrição do produto"></textarea>

<label>Preço</label>
<input type="number" step="0.01" name="preco" placeholder="Preço" required>

<label>Quantidade em estoque</label>
<input type="number" name="estoque" placeholder="Quantidade em estoque" required>

<label>Posição no cardápio</label>
<input type="number" name="ordem" min="1" value="<?=h($proximaOrdemCadastro)?>" placeholder="Ex: 1, 2, 3...">
<small class="form-help">
    Deixe como está para entrar no final. Para colocar no começo, use 1. Os outros produtos serão empurrados automaticamente.
</small>

<label>Imagem</label>
<input type="file" name="imagem">

<label>
    <input type="checkbox" name="ativo" checked>
    Produto Ativo
</label>

<br><br>

<label>
    <input type="checkbox" name="destaque">
    Produto Destaque
</label>

<br><br>

<button type="submit" name="salvar" class="btn-salvar">Salvar Produto</button>

</form>
</div>

<h2>📦 Produtos Cadastrados</h2>
<br>

<div class="produtos-grid">

<?php while($produto = $produtos->fetch_assoc()){ ?>

<div class="produto-card">

<?php if(!empty($produto['imagem'])){ ?>
<img src="uploads/<?=h($produto['imagem'])?>" alt="<?=h($produto['nome'])?>">
<?php }else{ ?>
<img src="https://via.placeholder.com/400x250?text=Sem+Imagem" alt="Sem imagem">
<?php } ?>

<div class="produto-body">

<span class="badge ordem">#<?=h($produto['ordem'])?> no cardápio</span>

<div class="produto-nome"><?=h($produto['nome'])?></div>

<div>Categoria: <strong><?=h($produto['categoria'])?></strong></div>

<p><?=nl2br(h($produto['descricao']))?></p>

<div class="produto-preco">
R$ <?=number_format((float)$produto['preco'], 2, ',', '.')?>
</div>

<p>Estoque: <strong><?=h($produto['estoque'])?></strong></p>

<?php if($produto['ativo']){ ?>
<span class="badge ativo">Ativo</span>
<?php }else{ ?>
<span class="badge inativo">Inativo</span>
<?php } ?>

<?php if($produto['destaque']){ ?>
<span class="badge destaque">Destaque</span>
<?php } ?>

<div class="acoes">
    <a href="editar_produto.php?id=<?=h($produto['id'])?>" class="btn-editar">Editar</a>
    <a href="produto_adicionais.php?produto_id=<?=h($produto['id'])?>" class="btn-adicionais">Adicionais</a>
    <a href="?excluir=<?=h($produto['id'])?>" class="btn-excluir" onclick="return confirm('Deseja excluir este produto?')">Excluir</a>
</div>

</div>
</div>

<?php } ?>

</div>

</div>
</div>
</body>
</html>
