<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function garantirColunasItensPedidoPainel($conn){
    $colunas = [];
    $res = $conn->query("SHOW COLUMNS FROM itens_pedido");
    if($res){
        while($c = $res->fetch_assoc()){
            $colunas[$c['Field']] = true;
        }
    }

    if(!isset($colunas['tipo_item'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN tipo_item VARCHAR(30) NOT NULL DEFAULT 'produto' AFTER produto_id");
    }

    if(!isset($colunas['item_id'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN item_id INT(11) DEFAULT NULL AFTER tipo_item");
    }

    if(!isset($colunas['nome_item'])){
        @$conn->query("ALTER TABLE itens_pedido ADD COLUMN nome_item VARCHAR(255) DEFAULT NULL AFTER item_id");
    }
}

garantirColunasItensPedidoPainel($conn);

if(!isset($_GET['id'])){
    header("Location: pedidos.php");
    exit;
}

$id = intval($_GET['id']);

$pedido = $conn->query("
SELECT
p.*,
c.nome,
c.telefone,
c.endereco,
c.numero,
c.bairro,
c.complemento,
c.referencia

FROM pedidos p

LEFT JOIN clientes c
ON c.id = p.cliente_id

WHERE p.id='$id'
")->fetch_assoc();

if(!$pedido){
    die("Pedido não encontrado.");
}

$itens = $conn->query("
SELECT
ip.*,
COALESCE(
    NULLIF(ip.nome_item, ''),
    CASE
        WHEN ip.tipo_item = 'combo' THEN cb.nome
        WHEN ip.tipo_item IN ('promocao','promoção') THEN pm.titulo
        ELSE pr.nome
    END,
    pr.nome,
    CONCAT('Item #', ip.produto_id)
) AS produto

FROM itens_pedido ip

LEFT JOIN produtos pr
ON pr.id = ip.produto_id

LEFT JOIN combos cb
ON cb.id = ip.item_id

LEFT JOIN promocoes pm
ON pm.id = ip.item_id

WHERE ip.pedido_id='$id'
");

$config = $conn->query("
SELECT *
FROM configuracoes
WHERE id=1
")->fetch_assoc();

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Imprimir Pedido #<?= $pedido['id']; ?></title>
<link rel="apple-touch-icon" href="icons/icon-192.png">

<style> *{ margin:0; padding:0; box-sizing:border-box; } html, body{ width:58mm; background:#fff; color:#000; font-family:Arial, Helvetica, sans-serif; font-size:12px; } body{ margin:0 auto; } .comanda{ width:58mm; padding:2mm; } .centro{ text-align:center; } .logo{ width:64px; height:auto; display:block; margin:0 auto 4px; } h2{ font-size:16px; margin-bottom:4px; } p{ margin:2px 0; line-height:1.3; } hr{ border:0; border-top:1px dashed #000; margin:6px 0; } .item{ margin-bottom:6px; font-size:12px; line-height:1.3; } .item strong{ display:block; } .total{ text-align:right; font-size:18px; font-weight:bold; margin-top:8px; } .obs{ border:1px dashed #000; padding:5px; margin-top:6px; font-size:11px; word-wrap:break-word; } .btn-print{ display:block; width:220px; margin:15px auto; padding:10px; background:#ff6b00; color:#fff; border:none; border-radius:5px; cursor:pointer; font-size:15px; } @media screen{ body{ background:#f2f2f2; } .comanda{ background:#fff; margin:15px auto; box-shadow:0 0 10px rgba(0,0,0,.15); } } @media print{ @page{ size:58mm auto; margin:0; } html, body{ width:58mm !important; margin:0 !important; padding:0 !important; background:#fff !important; } .btn-print{ display:none !important; } .comanda{ width:58mm !important; margin:0 !important; padding:2mm !important;
 box-shadow:none !important;
 } body{ zoom:1;
 } }
 </style>

</head>

<body>

<button
 class="btn-print" onclick="imprimirPedido()">
🖨 Imprimir Pedido
</button>


<div class="comanda">

<div class="centro">

<?php if(!empty($config['logo'])){ ?>

<img
src="uploads/<?= $config['logo']; ?>"
class="logo">

<?php } ?>

<h2>
<?= $config['nome_empresa'] ?? 'ESPETARIA'; ?>
</h2>

<p>
<?= $config['telefone'] ?? ''; ?>
</p>

<p>
<?= $config['endereco'] ?? ''; ?>
</p>

</div>

<hr>

<p>
<strong>Pedido:</strong>
#<?= $pedido['id']; ?>
</p>

<p>
<strong>Data:</strong>
<?= date('d/m/Y H:i', strtotime($pedido['criado_em'])); ?>
</p>

<p>
<strong>Status:</strong>
<?= $pedido['status']; ?>
</p>

<hr>

<p>
<strong>Cliente:</strong>
<?= $pedido['nome']; ?>
</p>

<p>
<strong>Telefone:</strong>
<?= $pedido['telefone']; ?>
</p>

<p>
<strong>Endereço:</strong>
<?= $pedido['endereco']; ?>,
<?= $pedido['numero']; ?>
</p>

<p>
<strong>Bairro:</strong>
<?= $pedido['bairro']; ?>
</p>

<?php if(!empty($pedido['complemento'])){ ?>

<p>
<strong>Compl.:</strong>
<?= $pedido['complemento']; ?>
</p>

<?php } ?>

<?php if(!empty($pedido['referencia'])){ ?>

<p>
<strong>Ref.:</strong>
<?= $pedido['referencia']; ?>
</p>

<?php } ?>

<hr>

<p>
<strong>ITENS</strong>
</p>

<?php while($item = $itens->fetch_assoc()){ ?>

<div class="item">

<strong>
<?= $item['quantidade']; ?>x
<?= $item['produto']; ?>
<?php if(!empty($item['tipo_item']) && $item['tipo_item'] !== 'produto'){ ?>
<br><small><?= strtoupper($item['tipo_item']); ?></small>
<?php } ?>
</strong>

<br>

R$
<?= number_format($item['valor_unitario'],2,',','.'); ?>
 cada

-
Subtotal:
R$
<?= number_format($item['subtotal'],2,',','.'); ?>

</div>

<?php } ?>

<hr>

<?php if(!empty($pedido['observacao'])){ ?>

<div class="obs">

<strong>Observação:</strong>
<br>
<?= nl2br($pedido['observacao']); ?>

</div>

<hr>

<?php } ?>

<p>
<strong>Pagamento:</strong>
<?= $pedido['pagamento']; ?>
</p>

<p class="total">
TOTAL:
R$
<?= number_format($pedido['total'],2,',','.'); ?>
</p>

<hr>

<div class="centro">

<p>
Obrigado pela preferência!
</p>

<p>
🍢 Volte sempre 🍢
</p>

</div>

</div>

<script> window.onload = function(){ setTimeout(function(){ window.print(); }, 300); } </script>

</body>

</html>

