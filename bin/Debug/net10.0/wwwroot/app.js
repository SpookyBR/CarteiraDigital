const API_URL = "";

let usuarios = [];
let contaAtivaId = localStorage.getItem("contaAtivaId") || "";

/* ===================== Utilidades ===================== */

function formatarMoeda(valor) {
	return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function corAvatar(id) {
	const paleta = ["#d4a24c", "#2dd4bf", "#8aa9ff", "#e08ac2", "#ecd095"];
	return paleta[id % paleta.length];
}

function iniciais(nome) {
	return nome.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

function mostrarToast(mensagem, tipo = "sucesso") {
	const container = document.getElementById("toastContainer");
	const toast = document.createElement("div");
	toast.className = "toast" + (tipo === "erro" ? " is-error" : "");
	toast.textContent = mensagem;
	container.appendChild(toast);
	setTimeout(() => toast.remove(), 4000);
}

async function chamarApi(caminho, opcoes) {
	try {
		const resposta = await fetch(`${API_URL}${caminho}`, opcoes);
		let dados = null;
		try { dados = await resposta.json(); } catch (e) { /* resposta sem corpo JSON */ }

		if (!resposta.ok) {
			const mensagemErro = (dados && (dados.mensagem || dados)) || `Erro ${resposta.status}`;
			mostrarToast(typeof mensagemErro === "string" ? mensagemErro : "Ocorreu um erro na operação.", "erro");
			return null;
		}
		return dados;
	} catch (erro) {
		mostrarToast("Não foi possível conectar à API.", "erro");
		return null;
	}
}

/* ===================== Usuários ===================== */

async function carregarUsuarios() {
	const lista = document.getElementById("listaUsuarios");
	const dados = await chamarApi("/usuarios");

	if (!dados) {
		lista.innerHTML = `<li class="empty-state">Não foi possível carregar os usuários.</li>`;
		return;
	}

	usuarios = dados;
	renderizarUsuarios(usuarios);
	preencherSeletores();
	atualizarCartaoConta();
}

function renderizarUsuarios(lista) {
	const container = document.getElementById("listaUsuarios");
	container.innerHTML = "";

	if (lista.length === 0) {
		container.innerHTML = `<li class="empty-state">Nenhum usuário encontrado.</li>`;
		return;
	}

	lista.forEach(u => {
		const item = document.createElement("li");
		item.innerHTML = `
			<span class="avatar" style="background:${corAvatar(u.id)}">${iniciais(u.nome)}</span>
			<span class="user-info">
				<span class="user-name">${u.nome}</span><br>
				<span class="user-id">ID ${u.id}</span>
			</span>
			<span class="user-balance">R$ ${formatarMoeda(u.saldo)}</span>
		`;
		item.style.cursor = "pointer";
		item.addEventListener("click", () => selecionarConta(u.id));
		container.appendChild(item);
	});
}

function preencherSeletores() {
	const contaAtiva = document.getElementById("contaAtiva");
	const destinoTransf = document.getElementById("destinoTransf");

	contaAtiva.innerHTML = `<option value="">Selecione um usuário…</option>`;
	destinoTransf.innerHTML = `<option value="">Selecione o destinatário…</option>`;

	usuarios.forEach(u => {
		contaAtiva.innerHTML += `<option value="${u.id}">${u.nome} (ID ${u.id})</option>`;
		if (String(u.id) !== String(contaAtivaId)) {
			destinoTransf.innerHTML += `<option value="${u.id}">${u.nome} (ID ${u.id})</option>`;
		}
	});

	if (contaAtivaId && usuarios.some(u => String(u.id) === String(contaAtivaId))) {
		contaAtiva.value = contaAtivaId;
	}
}

function selecionarConta(id) {
	contaAtivaId = String(id);
	localStorage.setItem("contaAtivaId", contaAtivaId);
	document.getElementById("contaAtiva").value = contaAtivaId;
	preencherSeletores();
	atualizarCartaoConta();
}

function atualizarCartaoConta(direcao) {
	const usuario = usuarios.find(u => String(u.id) === String(contaAtivaId));
	const amountEl = document.getElementById("walletAmount");
	const ownerEl = document.getElementById("walletOwner");
	const idEl = document.getElementById("walletId");

	if (!usuario) {
		amountEl.textContent = "0,00";
		ownerEl.textContent = "Nenhuma conta selecionada";
		idEl.innerHTML = "&nbsp;";
		return;
	}

	amountEl.textContent = formatarMoeda(usuario.saldo);
	ownerEl.textContent = usuario.nome;
	idEl.textContent = `ID ${usuario.id}`;

	if (direcao) {
		amountEl.classList.remove("is-up", "is-down");
		amountEl.classList.add(direcao === "up" ? "is-up" : "is-down");
		setTimeout(() => amountEl.classList.remove("is-up", "is-down"), 900);
	}
}

async function cadastrarUsuario(evento) {
	evento.preventDefault();
	const campo = document.getElementById("nomeUsuario");
	const nome = campo.value.trim();

	if (!nome) {
		mostrarToast("Digite um nome para o usuário.", "erro");
		return;
	}

	const dados = await chamarApi("/usuarios", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ nome })
	});

	if (dados) {
		mostrarToast(`Usuário "${nome}" cadastrado com sucesso!`);
		campo.value = "";
		fecharModalNovoUsuario();
		await carregarUsuarios();
		selecionarConta(dados.id);
	}
}

/* ===================== Operações financeiras ===================== */

function contaSelecionadaOuAviso() {
	if (!contaAtivaId) {
		mostrarToast("Selecione uma conta ativa primeiro.", "erro");
		return null;
	}
	return parseInt(contaAtivaId, 10);
}

async function realizarOperacao(evento, tipo) {
	evento.preventDefault();
	const usuarioId = contaSelecionadaOuAviso();
	if (!usuarioId) return;

	const campoValor = document.getElementById(tipo === "deposito" ? "valorDeposito" : "valorSaque");
	const valor = parseFloat(campoValor.value);

	if (!valor || valor <= 0) {
		mostrarToast("Informe um valor válido.", "erro");
		return;
	}

	const dados = await chamarApi(`/carteira/${tipo}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ usuarioId, valor })
	});

	if (dados) {
		mostrarToast(dados.mensagem);
		campoValor.value = "";
		await carregarUsuarios();
		atualizarCartaoConta(tipo === "deposito" ? "up" : "down");
	}
}

async function realizarTransferencia(evento) {
	evento.preventDefault();
	const origemUsuarioId = contaSelecionadaOuAviso();
	if (!origemUsuarioId) return;

	const destinoUsuarioId = parseInt(document.getElementById("destinoTransf").value, 10);
	const campoValor = document.getElementById("valorTransf");
	const valor = parseFloat(campoValor.value);

	if (!destinoUsuarioId) {
		mostrarToast("Selecione o destinatário da transferência.", "erro");
		return;
	}
	if (!valor || valor <= 0) {
		mostrarToast("Informe um valor válido.", "erro");
		return;
	}

	const dados = await chamarApi("/carteira/transferencia", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ origemUsuarioId, destinoUsuarioId, valor })
	});

	if (dados) {
		mostrarToast(dados.mensagem);
		campoValor.value = "";
		await carregarUsuarios();
		await carregarHistorico();
		atualizarCartaoConta("down");
	}
}

/* ===================== Histórico ===================== */

async function carregarHistorico() {
	const lista = document.getElementById("listaHistorico");
	const dados = await chamarApi("/carteira/transferencias");

	if (!dados) {
		lista.innerHTML = `<li class="empty-state">Não foi possível carregar o histórico.</li>`;
		return;
	}

	if (dados.length === 0) {
		lista.innerHTML = `<li class="empty-state">Nenhuma transferência registrada ainda.</li>`;
		return;
	}

	lista.innerHTML = "";
	dados.slice().reverse().forEach(t => {
		const item = document.createElement("li");
		item.innerHTML = `
			<span class="history-item__label"><strong>${t.origem}</strong> → ${t.destino}</span>
			<span class="history-item__value">R$ ${formatarMoeda(t.valor)}</span>
		`;
		lista.appendChild(item);
	});
}

/* ===================== Interface: abas, modal, busca ===================== */

function configurarTabsOperacao() {
	const tabs = document.querySelectorAll(".account-panel .tab");
	tabs.forEach(tab => {
		tab.addEventListener("click", () => {
			tabs.forEach(t => t.classList.remove("is-active"));
			document.querySelectorAll(".account-panel .tab-panel").forEach(p => p.classList.remove("is-active"));
			tab.classList.add("is-active");
			document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
		});
	});
}

function configurarTabsLateral() {
	const tabs = document.querySelectorAll(".side-panel .tab");
	tabs.forEach(tab => {
		tab.addEventListener("click", () => {
			tabs.forEach(t => t.classList.remove("is-active"));
			document.querySelectorAll(".side-view").forEach(v => v.classList.remove("is-active"));
			tab.classList.add("is-active");
			document.querySelector(`.side-view[data-side-panel="${tab.dataset.side}"]`).classList.add("is-active");
			if (tab.dataset.side === "historico") carregarHistorico();
		});
	});
}

function abrirModalNovoUsuario() {
	document.getElementById("modalBackdrop").classList.add("is-open");
	document.getElementById("nomeUsuario").focus();
}

function fecharModalNovoUsuario() {
	document.getElementById("modalBackdrop").classList.remove("is-open");
}

function configurarBusca() {
	document.getElementById("buscaUsuario").addEventListener("input", (evento) => {
		const termo = evento.target.value.trim().toLowerCase();
		const filtrados = usuarios.filter(u =>
			u.nome.toLowerCase().includes(termo) || String(u.id).includes(termo)
		);
		renderizarUsuarios(filtrados);
	});
}

/* ===================== Inicialização ===================== */

document.addEventListener("DOMContentLoaded", () => {
	configurarTabsOperacao();
	configurarTabsLateral();
	configurarBusca();

	document.getElementById("formNovoUsuario").addEventListener("submit", cadastrarUsuario);
	document.getElementById("formDeposito").addEventListener("submit", (e) => realizarOperacao(e, "deposito"));
	document.getElementById("formSaque").addEventListener("submit", (e) => realizarOperacao(e, "saque"));
	document.getElementById("formTransferencia").addEventListener("submit", realizarTransferencia);

	document.getElementById("btnNovoUsuario").addEventListener("click", abrirModalNovoUsuario);
	document.getElementById("btnCancelarNovoUsuario").addEventListener("click", fecharModalNovoUsuario);
	document.getElementById("modalBackdrop").addEventListener("click", (e) => {
		if (e.target.id === "modalBackdrop") fecharModalNovoUsuario();
	});

	document.getElementById("contaAtiva").addEventListener("change", (e) => {
		if (e.target.value) selecionarConta(e.target.value);
	});

	carregarUsuarios();
	carregarHistorico();
});
