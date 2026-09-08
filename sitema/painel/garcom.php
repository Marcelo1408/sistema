<?php
session_start();
include 'includes/conexao.php';

// Função para escapar HTML
function h($valor) {
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

// ---- AÇÕES ----

// Nova comanda
if (isset($_POST['nova_comanda'])) {
    $mesa = $conn->real_escape_string($_POST['mesa']);
    $cliente = $conn->real_escape_string($_POST['cliente']);
    $conn->query("INSERT INTO comandas (mesa_numero, nome_cliente) VALUES ('$mesa', '$cliente')");
    $id = $conn->insert_id;
    header("Location: garcom.php?id=$id");
    exit;
}

// Adicionar item
if (isset($_POST['add_item']) && isset($_GET['id'])) {
    $comanda_id = (int)$_GET['id'];
    $produto_id = (int)$_POST['produto_id'];
    $quantidade = max(1, (int)$_POST['quantidade']);

    // Busca preço do produto
    $res = $conn->query("SELECT preco, estoque FROM produtos WHERE id = $produto_id AND ativo = 1");
    if ($res && $res->num_rows > 0) {
        $prod = $res->fetch_assoc();
        $preco = $prod['preco'];
        $estoque = $prod['estoque'];

        if ($estoque >= $quantidade) {
            // Insere item
            $subtotal = $preco * $quantidade;
            $conn->query("INSERT INTO comanda_itens (comanda_id, produto_id, quantidade, preco_unitario, subtotal)
                          VALUES ($comanda_id, $produto_id, $quantidade, $preco, $subtotal)");

            // Atualiza estoque (saída)
            $conn->query("UPDATE produtos SET estoque = estoque - $quantidade WHERE id = $produto_id");
            $conn->query("INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, observacao)
                          VALUES ($produto_id, 'SAIDA', $quantidade, 'Comanda #$comanda_id')");
        } else {
            $erro = "Estoque insuficiente!";
        }
    }
    header("Location: garcom.php?id=$comanda_id" . (isset($erro) ? "&erro=" . urlencode($erro) : ""));
    exit;
}

// Fechar comanda (garçom finaliza)
if (isset($_GET['fechar']) && isset($_GET['id'])) {
    $comanda_id = (int)$_GET['id'];
    // Calcula total
    $res = $conn->query("SELECT SUM(subtotal) AS total FROM comanda_itens WHERE comanda_id = $comanda_id");
    $total = $res->fetch_assoc()['total'] ?? 0;
    $conn->query("UPDATE comandas SET total = $total, status = 'fechada', data_fechamento = NOW() WHERE id = $comanda_id");
    header("Location: garcom.php");
    exit;
}

// Excluir item (caso queira)
if (isset($_GET['del_item']) && isset($_GET['id'])) {
    $comanda_id = (int)$_GET['id'];
    $item_id = (int)$_GET['del_item'];
    // Repõe estoque antes de excluir
    $res = $conn->query("SELECT produto_id, quantidade FROM comanda_itens WHERE id = $item_id AND comanda_id = $comanda_id");
    if ($res && $res->num_rows > 0) {
        $item = $res->fetch_assoc();
        $conn->query("UPDATE produtos SET estoque = estoque + {$item['quantidade']} WHERE id = {$item['produto_id']}");
        $conn->query("INSERT INTO estoque_movimentacoes (produto_id, tipo, quantidade, observacao)
                      VALUES ({$item['produto_id']}, 'ENTRADA', {$item['quantidade']}, 'Cancelamento item comanda #$comanda_id')");
        $conn->query("DELETE FROM comanda_itens WHERE id = $item_id");
    }
    header("Location: garcom.php?id=$comanda_id");
    exit;
}

// ---- EXIBIÇÃO ----
$comanda_aberta = null;
$itens = [];
$categorias = $conn->query("SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome");

// Se tem ID na URL, carrega comanda
if (isset($_GET['id'])) {
    $comanda_id = (int)$_GET['id'];
    $res = $conn->query("SELECT * FROM comandas WHERE id = $comanda_id AND status = 'aberta'");
    if ($res && $res->num_rows > 0) {
        $comanda_aberta = $res->fetch_assoc();
        $itens = $conn->query("SELECT ci.*, p.nome FROM comanda_itens ci
                               JOIN produtos p ON p.id = ci.produto_id
                               WHERE ci.comanda_id = $comanda_id");
    }
}

// Lista comandas abertas para tela inicial
$comandas_abertas = $conn->query("SELECT * FROM comandas WHERE status = 'aberta' ORDER BY id DESC");
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comanda Digital</title>
    <style>
        * { box-sizing: border-box; font-family: Arial, sans-serif; }
        body { margin: 0; padding: 15px; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; }
        .card { background: #fff; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        h2, h3 { margin: 0 0 10px; }
        .btn { display: inline-block; padding: 10px 15px; border: none; border-radius: 8px; text-decoration: none; cursor: pointer; font-size: 16px; }
        .btn-primary { background: #198754; color: #fff; }
        .btn-danger { background: #dc3545; color: #fff; }
        .btn-sm { padding: 5px 10px; font-size: 14px; }
        input, select { width: 100%; padding: 10px; margin: 5px 0 15px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; }
        .item-list { list-style: none; padding: 0; }
        .item-list li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .total { font-size: 24px; font-weight: bold; text-align: right; margin-top: 10px; }
        .erro { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-bottom: 15px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    </style>
</head>
<body>
<div class="container">

<?php if (isset($_GET['erro'])): ?>
    <div class="erro"><?= h($_GET['erro']) ?></div>
<?php endif; ?>

<?php if ($comanda_aberta): ?>
    <!-- Tela da comanda aberta -->
    <div class="card">
        <h2>Mesa <?= h($comanda_aberta['mesa_numero']) ?> – <?= h($comanda_aberta['nome_cliente']) ?></h2>
        <a href="garcom.php" class="btn btn-sm" style="background:#6c757d; color:#fff;">← Voltar</a>
        <a href="garcom.php?id=<?= $comanda_aberta['id'] ?>&fechar=1" class="btn btn-danger btn-sm" onclick="return confirm('Fechar comanda?')">Fechar Comanda</a>
    </div>

    <!-- Lista de itens -->
    <div class="card">
        <h3>Itens</h3>
        <?php if ($itens && $itens->num_rows > 0): ?>
            <ul class="item-list">
                <?php while ($item = $itens->fetch_assoc()): ?>
                    <li>
                        <span><?= h($item['nome']) ?> x<?= $item['quantidade'] ?></span>
                        <span>R$ <?= number_format($item['subtotal'], 2, ',', '.') ?></span>
                        <a href="garcom.php?id=<?= $comanda_aberta['id'] ?>&del_item=<?= $item['id'] ?>" class="btn btn-sm btn-danger" style="margin-left:10px;">X</a>
                    </li>
                <?php endwhile; ?>
            </ul>
            <div class="total">
                Total: R$ <?php
                $total_comanda = 0;
                $itens->data_seek(0);
                while ($i = $itens->fetch_assoc()) $total_comanda += $i['subtotal'];
                echo number_format($total_comanda, 2, ',', '.');
                ?>
            </div>
        <?php else: ?>
            <p>Nenhum item adicionado.</p>
        <?php endif; ?>
    </div>

    <!-- Adicionar produto -->
    <div class="card">
        <h3>Adicionar Produto</h3>
        <form method="POST">
            <label>Categoria</label>
            <select id="categoria" onchange="filtrarProdutos()">
                <option value="">Selecione</option>
                <?php $categorias->data_seek(0); while ($cat = $categorias->fetch_assoc()): ?>
                    <option value="<?= $cat['id'] ?>"><?= h($cat['nome']) ?></option>
                <?php endwhile; ?>
            </select>

            <label>Produto</label>
            <select name="produto_id" id="produto">
                <option value="">-- Escolha a categoria --</option>
            </select>

            <label>Quantidade</label>
            <input type="number" name="quantidade" value="1" min="1" required>

            <button type="submit" name="add_item" class="btn btn-primary" style="width:100%; margin-top:10px;">Adicionar</button>
        </form>
    </div>

    <script>
    // Carrega produtos via AJAX ao selecionar categoria
    function filtrarProdutos() {
        var catId = document.getElementById('categoria').value;
        var selectProd = document.getElementById('produto');
        selectProd.innerHTML = '<option value="">Carregando...</option>';
        if (catId) {
            fetch('ajax_produtos_por_categoria.php?cat=' + catId)
                .then(r => r.json())
                .then(data => {
                    selectProd.innerHTML = '<option value="">Selecione</option>';
                    data.forEach(p => {
                        selectProd.innerHTML += `<option value="${p.id}">${p.nome} – R$ ${p.preco}</option>`;
                    });
                });
        } else {
            selectProd.innerHTML = '<option value="">-- Escolha a categoria --</option>';
        }
    }
    </script>

<?php else: ?>
    <!-- Tela inicial: comandas abertas + nova comanda -->
    <div class="card">
        <h2>Comandas Abertas</h2>
        <?php if ($comandas_abertas->num_rows > 0): ?>
            <?php while ($c = $comandas_abertas->fetch_assoc()): ?>
                <div style="padding:10px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between;">
                    <div>
                        <strong>Mesa <?= h($c['mesa_numero']) ?></strong>
                        <?php if ($c['nome_cliente']): ?> – <?= h($c['nome_cliente']) ?><?php endif; ?>
                    </div>
                    <a href="garcom.php?id=<?= $c['id'] ?>" class="btn btn-sm btn-primary">Abrir</a>
                </div>
            <?php endwhile; ?>
        <?php else: ?>
            <p>Nenhuma comanda aberta.</p>
        <?php endif; ?>
    </div>

    <div class="card">
        <h3>Nova Comanda</h3>
        <form method="POST">
            <label>Número da Mesa</label>
            <input type="text" name="mesa" placeholder="Ex: 5" required>
            <label>Nome do Cliente</label>
            <input type="text" name="cliente" placeholder="Opcional">
            <button type="submit" name="nova_comanda" class="btn btn-primary" style="width:100%;">Criar Comanda</button>
        </form>
    </div>
<?php endif; ?>

</div>
</body>
</html>