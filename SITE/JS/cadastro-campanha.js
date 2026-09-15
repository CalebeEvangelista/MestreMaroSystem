const db = firebase.firestore();

const form = document.querySelector(".campaign-form");
const submitBtn = form?.querySelector('button[type="submit"]');

async function enviarFormularioPromocao(event) {
  event.preventDefault();

  if (!form) return;

  const dados = {
    nome: document.getElementById("nome")?.value.trim() || "",
    telefone: document.getElementById("telefone")?.value.trim() || "",
    email: document.getElementById("email")?.value.trim() || "",
    loja: document.getElementById("loja")?.value.trim() || "",
    endereco: document.getElementById("endereco")?.value.trim() || "",
    cidade: document.getElementById("cidade")?.value.trim() || "",
    estado: document.getElementById("estado")?.value.trim() || "",
    segmento: document.getElementById("segmento")?.value || "",
    funcionarios: document.getElementById("funcionarios")?.value || "",
    operacao: document.getElementById("operacao")?.value || "",
    faturamento: document.getElementById("faturamento")?.value || "",
    vendas: document.getElementById("vendas")?.value || "",
    sistema: document.getElementById("sistema")?.value || "",
    desafio: document.getElementById("desafio")?.value.trim() || "",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    origem: "campanha-3-meses-gratis"
  };

  if (
    !dados.nome ||
    !dados.telefone ||
    !dados.loja ||
    !dados.endereco ||
    !dados.segmento ||
    !dados.funcionarios ||
    !dados.operacao ||
    !dados.faturamento ||
    !dados.sistema
  ) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando...";
    }

    await db.collection("promocional").add(dados);

    await Swal.fire({
        icon: "success",
        title: "Obrigado pelo seu interesse!",
        text: "Recebemos seu cadastro com sucesso. Em breve, um de nossos consultores entrará em contato com você.",
        confirmButtonText: "Entendi",
        confirmButtonColor: "#f4c400",
        background: "#171717",
        color: "#ffffff"
    });

    //form.reset();
    //window.location.href = "/";

    // window.location.href = "/obrigado";
  } catch (error) {
    console.error("Erro ao enviar cadastro:", error);
    alert("Não foi possível enviar o cadastro. Tente novamente.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Quero participar da campanha";
    }
  }
}

if (form) {
  form.addEventListener("submit", enviarFormularioPromocao);
}