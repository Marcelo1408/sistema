<?php
include 'includes/conexao.php';

$cat = (int)$_GET['cat'];
$produtos = $conn->query("SELECT id, nome, preco FROM produtos WHERE categoria_id = $cat AND ativo = 1 ORDER BY nome");

$lista = [];
while ($p = $produtos->fetch_assoc()) {
    $lista[] = [
        'id' => $p['id'],
        'nome' => $p['nome'],
        'preco' => number_format($p['preco'], 2, ',', '.')
    ];
}
header('Content-Type: application/json');
echo json_encode($lista);