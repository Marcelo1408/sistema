<?php

if(session_status() === PHP_SESSION_NONE){
    session_start();
}

if(!isset($conn)){
    include __DIR__ . '/conexao.php';
}

$configLogo = $conn->query("
SELECT nome_empresa, logo
FROM configuracoes
WHERE id=1
")->fetch_assoc();

?>

<div class="sidebar">
 

    <div class="logo logo-compacta">

        <?php if(!empty($configLogo['logo'])){ ?>

            <img
              src="uploads/<?= $configLogo['logo']; ?>"
              class="logo-img">

        <?php } else { ?>

            <div class="logo-icone">🍢</div>

        <?php } ?>

        <span>
            <?= $configLogo['nome_empresa'] ?? 'ESPETARIA'; ?>
        </span>

    </div>

    <div class="menu">

        <a href="dashboard.php">📊 Dashboard</a>
        <a href="pedidos.php">🛒 Pedidos</a>
        <a href="garcom.php">📝 Garcom</a>
        <a href="comandas.php">📋 Comandas</a>
        <a href="clientes.php">👥 Clientes</a>
        <a href="promocoes.php">📢 Promoções</a>
        <a href="produtos.php">🍢 Produtos</a>
        <a href="embalagens.php">🛍️ Embalagens</a>
        <a href="estoque.php">📦 Estoque</a>
        <a href="combos.php">🎁 Combos</a>
        <a href="adicionais.php">➕ Adicionais</a>
        <a href="categorias.php">📂 Categorias</a>
        <a href="relatorios.php">📈 Relatórios</a>
        <a href="financeiro.php">💰 Financeiro</a>
        <a href="cupons.php">🎟 Cupons</a>
        <a href="entregadores.php">🏍 Entregadores</a>
         <a href="configuracoes.php">⚙ Configurações</a>
         <a href="usuarios.php">👤 Usuários</a>
         <a href="alterar_perfil.php">🔐 Alterar Perfil</a>
        <a href="logout.php">🚪 Sair</a>

    </div>

</div>