<div class="topbar">

    <div style="display:flex; align-items:center; gap:12px;">

       <button class="menu-toggle" onclick="toggleMenu()">
         MENU
        </button>

        <strong>
            Painel Administrativo
        </strong>

    </div>

    <div>
        👤 <?= $_SESSION['nome']; ?>

        <small style="color:#888;">
            (<?= $_SESSION['nivel']; ?>)
        </small>
    </div>

</div>

<script>
function toggleMenu(){
    document.querySelector('.sidebar').classList.toggle('aberto');
}
</script>