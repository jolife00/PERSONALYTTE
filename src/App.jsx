import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle, Clock, Phone, AlertCircle,
  ChevronLeft, ChevronRight, Calendar, Trash2,
  UserPlus, X, Info, Settings, LayoutDashboard,
  Users, Key, Banknote, Edit2, ArrowRightLeft,
  Search, Activity
} from 'lucide-react';

// ============================================================================
// COLE AQUI A NOVA URL DO DEPLOY DO GOOGLE APPS SCRIPT:
// ============================================================================
const URL_DO_GOOGLE_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbwZ3UGr7Q8kL_WhMd7zrjNjtyzP3bpBHuQ0lDvNdM3L7HfG6mxPfnW5h055-JYYCl9H/exec';
// ============================================================================

const getIsoDate = (date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().split('T')[0];
};

export default function DiarioDeClasse() {
  const [activeTab, setActiveTab] = useState('diario');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [db, setDb] = useState({});
  const [todasMatriculas, setTodasMatriculas] = useState([]);
  const [todasLocacoes, setTodasLocacoes] = useState([]);
  const [gradeMestre, setGradeMestre] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLocacaoModalOpen, setIsLocacaoModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [modalAulaId, setModalAulaId] = useState(null);
  const [editandoAlunoId, setEditandoAlunoId] = useState(null);
  const [novoAluno, setNovoAluno] = useState({ nome: '', whatsapp: '', nivel: 'FUN', plano: 'Avulso', recorrencia: '1' });
  const [novoHorario, setNovoHorario] = useState({ horario: '', professor: '' });
  const [novaLocacao, setNovaLocacao] = useState({ horario: '', nomeCliente: '', whatsapp: '', valor: '' });
  const [moveInfo, setMoveInfo] = useState({ alunoId: null, nome: '', fromAulaId: null, toAulaId: '' });

  // Busca do Painel
  const [buscaAluno, setBuscaAluno] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'info', actionLink: null });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null });

  const dateKey = getIsoDate(currentDate);
  const aulasDoDia = db[dateKey] || [];
  const locacoesDoDia = todasLocacoes.filter(loc => loc.data === dateKey);

  const showToast = (message, type = 'info', actionLink = null) => {
    setToast({ show: true, message, type, actionLink });
    setTimeout(() => setToast({ show: false, message: '', type: 'info', actionLink: null }), 6000);
  };

  /* STREAMING_CHUNK:Carregando Dados... */
  useEffect(() => {
    if (!URL_DO_GOOGLE_APPS_SCRIPT || URL_DO_GOOGLE_APPS_SCRIPT === 'COLE_AQUI_A_SUA_URL') return;

    const carregarDados = async () => {
      setLoading(true);
      try {
        const response = await fetch(URL_DO_GOOGLE_APPS_SCRIPT);
        const result = await response.json();
        if (result.sucesso) {
          setGradeMestre(result.horariosBase);
          setTodasMatriculas(result.matriculas);
          setTodasLocacoes(result.locacoes || []);

          const novoDb = {};
          result.matriculas.forEach(aluno => {
            const data = aluno.dataAula;
            if (!novoDb[data]) novoDb[data] = result.horariosBase.map(h => ({ ...h, alunos: [] }));
            const aulaIndex = novoDb[data].findIndex(a => a.id === aluno.aulaId);
            if (aulaIndex !== -1) novoDb[data][aulaIndex].alunos.push(aluno);
          });
          setDb(novoDb);
        }
      } catch (error) {
        showToast("Erro ao conectar com a planilha.", "error");
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (gradeMestre.length > 0 && typeof db[dateKey] === 'undefined') {
      setDb(prev => ({ ...prev, [dateKey]: gradeMestre.map(h => ({ ...h, alunos: [] })) }));
    }
  }, [currentDate, gradeMestre, dateKey, db]);

  const performAction = async (action, payload, onSuccess) => {
    setLoading(true);
    try {
      const response = await fetch(URL_DO_GOOGLE_APPS_SCRIPT, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
      const result = await response.json();
      if (result.sucesso) {
        onSuccess(result);
        if (result.mensagem) showToast(result.mensagem, 'success');
      } else showToast(result.mensagem || 'Erro ao processar.', 'error');
    } catch (error) { showToast('Erro de conexão.', 'error'); }
    finally { setLoading(false); }
  };

  /* STREAMING_CHUNK:Ações de Aulas e Alunos... */
  const handleAdicionarHorario = (e) => {
    e.preventDefault();
    performAction('ADD_HORARIO', novoHorario, (result) => {
      const novaAula = { id: result.novoId, ...novoHorario, alunos: [] };
      setGradeMestre(prev => [...prev, novaAula]);
      setDb(prev => {
        const novoDb = { ...prev };
        Object.keys(novoDb).forEach(data => { if (!novoDb[data].some(a => a.id === result.novoId)) novoDb[data].push({ ...novaAula }); });
        return novoDb;
      });
      setIsConfigOpen(false); setNovoHorario({ horario: '', professor: '' });
    });
  };

  const abrirEdicaoAluno = (aulaId, aluno) => {
    setModalAulaId(aulaId);
    setEditandoAlunoId(aluno.id);
    setNovoAluno({ nome: aluno.nome, whatsapp: aluno.whatsapp || '', nivel: aluno.nivel, plano: aluno.plano, recorrencia: '1' });
    setIsModalOpen(true);
  };

  const handleSalvarAluno = (e) => {
    e.preventDefault();
    if (editandoAlunoId) {
      performAction('EDIT_ALUNO', { alunoId: editandoAlunoId, aluno: novoAluno }, () => {
        setDb(prev => {
          const novoDb = { ...prev };
          const aIdx = novoDb[dateKey].findIndex(a => a.id === modalAulaId);
          if (aIdx !== -1) {
            const alIdx = novoDb[dateKey][aIdx].alunos.findIndex(al => al.id === editandoAlunoId);
            if (alIdx !== -1) novoDb[dateKey][aIdx].alunos[alIdx] = { ...novoDb[dateKey][aIdx].alunos[alIdx], ...novoAluno };
          }
          return novoDb;
        });
        setTodasMatriculas(p => p.map(a => a.id === editandoAlunoId ? { ...a, ...novoAluno } : a));
        setIsModalOpen(false); setEditandoAlunoId(null);
      });
      return;
    }

    const datasAula = [];
    const semanas = parseInt(novoAluno.recorrencia);
    for (let i = 0; i < semanas; i++) {
      const d = new Date(currentDate); d.setDate(d.getDate() + (i * 7)); datasAula.push(getIsoDate(d));
    }

    performAction('ADD_ALUNO', { datasAula, aulaId: modalAulaId, aluno: novoAluno }, (result) => {
      setTodasMatriculas(prev => {
        const novas = result.alunosCadastrados.filter(novo => !prev.some(a => a.id === novo.id));
        return [...prev, ...novas];
      });
      setDb(prev => {
        const novoDb = { ...prev };
        result.alunosCadastrados.forEach(al => {
          const dataAula = al.dataAula;
          if (!novoDb[dataAula]) novoDb[dataAula] = gradeMestre.map(h => ({ ...h, alunos: [] }));
          else novoDb[dataAula] = [...novoDb[dataAula]];

          const aIdx = novoDb[dataAula].findIndex(a => a.id === modalAulaId);
          if (aIdx !== -1) {
            const aulaAtualizada = { ...novoDb[dataAula][aIdx] };
            aulaAtualizada.alunos = [...aulaAtualizada.alunos];
            const jaExiste = aulaAtualizada.alunos.some(ex => ex.id === al.id || ex.nome.toLowerCase().trim() === al.nome.toLowerCase().trim());
            if (!jaExiste) {
              aulaAtualizada.alunos = [...aulaAtualizada.alunos, al];
              novoDb[dataAula][aIdx] = aulaAtualizada;
            }
          }
        });
        return novoDb;
      });
      setIsModalOpen(false);
    });
  };

  const abrirModalMover = (aulaId, aluno) => {
    setMoveInfo({ alunoId: aluno.id, nome: aluno.nome, fromAulaId: aulaId, toAulaId: '' });
    setIsMoveModalOpen(true);
  };

  const handleMoverAluno = (e) => {
    e.preventDefault();
    if (!moveInfo.toAulaId || moveInfo.toAulaId === moveInfo.fromAulaId) return;

    performAction('MOVE_ALUNO', { alunoId: moveInfo.alunoId, dataAula: dateKey, newAulaId: moveInfo.toAulaId }, (result) => {
      setDb(prev => {
        const novoDb = { ...prev };
        const dia = novoDb[dateKey];
        const oldAulaIdx = dia.findIndex(a => a.id === moveInfo.fromAulaId);
        const alunoIdx = dia[oldAulaIdx].alunos.findIndex(al => al.id === moveInfo.alunoId);
        const alunoMovido = { ...dia[oldAulaIdx].alunos[alunoIdx], status: result.novoStatus };
        dia[oldAulaIdx].alunos.splice(alunoIdx, 1);
        if (result.promovidoId) {
          const promoIdx = dia[oldAulaIdx].alunos.findIndex(al => al.id === result.promovidoId);
          if (promoIdx !== -1) dia[oldAulaIdx].alunos[promoIdx].status = 'Confirmado';
        }
        const newAulaIdx = dia.findIndex(a => a.id === moveInfo.toAulaId);
        dia[newAulaIdx].alunos.push(alunoMovido);
        return novoDb;
      });

      let msg = `${moveInfo.nome} transferido(a) com sucesso!`;
      let wpp = null;
      if (result.promovidoId) {
        msg += ` E a vaga antiga foi preenchida por ${result.promovidoNome}.`;
        wpp = result.promovidoWhatsapp ? `https://wa.me/55${result.promovidoWhatsapp.replace(/\D/g, '')}?text=Sua%20vaga%20abriu!` : null;
      }
      showToast(msg, 'success', wpp);
      setIsMoveModalOpen(false);
    });
  };

  const handleSalvarLocacao = (e) => {
    e.preventDefault();
    const getHoraInicio = (str) => {
      const match = str.match(/\d{2}/);
      return match ? parseInt(match[0], 10) : null;
    };
    const horaInicioSolicitada = getHoraInicio(novaLocacao.horario);

    if (horaInicioSolicitada !== null) {
      const conflitoAula = aulasDoDia.find(aula => getHoraInicio(aula.horario) === horaInicioSolicitada);
      if (conflitoAula) return showToast(`Conflito! Já existe uma AULA (${conflitoAula.horario}) na quadra.`, 'error');

      const conflitoLocacao = locacoesDoDia.find(loc => getHoraInicio(loc.horario) === horaInicioSolicitada);
      if (conflitoLocacao) return showToast(`Conflito! A quadra já está ALUGADA neste horário.`, 'error');
    }

    performAction('ADD_LOCACAO', { data: dateKey, locacao: novaLocacao }, (result) => {
      setTodasLocacoes(prev => [...prev, result.novaLocacao]);
      setIsLocacaoModalOpen(false);
      setNovaLocacao({ horario: '', nomeCliente: '', whatsapp: '', valor: '' });
    });
  };

  /* STREAMING_CHUNK:Ações Rápidas... */
  const togglePresenca = (aId, alId) => performAction('TOGGLE_PRESENCE', { alunoId: alId }, () => {
    setDb(p => ({ ...p, [dateKey]: p[dateKey].map(a => a.id === aId ? { ...a, alunos: a.alunos.map(al => al.id === alId ? { ...al, presente: !al.presente } : al) } : a) }));
    setTodasMatriculas(p => p.map(a => a.id === alId ? { ...a, presente: !a.presente } : a));
  });

  const toggleCheckin = (aId, alId) => performAction('TOGGLE_CHECKIN', { alunoId: alId }, () => {
    setDb(p => ({ ...p, [dateKey]: p[dateKey].map(a => a.id === aId ? { ...a, alunos: a.alunos.map(al => al.id === alId ? { ...al, parceiroCheckin: !al.parceiroCheckin } : al) } : a) }));
    setTodasMatriculas(p => p.map(a => a.id === alId ? { ...a, parceiroCheckin: !a.parceiroCheckin } : a));
  });

  const togglePagamentoLocacao = (locId) => performAction('TOGGLE_PAGAMENTO', { locacaoId: locId }, () => {
    setTodasLocacoes(p => p.map(l => l.id === locId ? { ...l, pago: !l.pago } : l));
  });

  const pedirRemocaoAluno = (aId, alId, nome) => setConfirmDialog({
    show: true, title: 'Cancelar Matrícula', message: `Remover ${nome}?`, onConfirm: () => performAction('REMOVE_ALUNO', { alunoId: alId }, (result) => {
      setDb(p => {
        const n = { ...p };
        const aIdx = n[dateKey].findIndex(a => a.id === aId);
        if (aIdx !== -1) {
          n[dateKey][aIdx] = { ...n[dateKey][aIdx], alunos: n[dateKey][aIdx].alunos.filter(al => al.id !== alId) };
          if (result.promovidoId) {
            const pIdx = n[dateKey][aIdx].alunos.findIndex(al => al.id === result.promovidoId);
            if (pIdx !== -1) n[dateKey][aIdx].alunos[pIdx].status = 'Confirmado';
          }
        }
        return n;
      });
      setTodasMatriculas(p => {
        let novas = p.filter(a => a.id !== alId);
        if (result.promovidoId) novas = novas.map(a => a.id === result.promovidoId ? { ...a, status: 'Confirmado' } : a);
        return novas;
      });
      setConfirmDialog({ show: false });

      if (result.promovidoId) {
        const msg = `Vaga liberada! ${result.promovidoNome} assumiu a vaga.`;
        const wppLink = result.promovidoWhatsapp ? `https://wa.me/55${result.promovidoWhatsapp.replace(/\D/g, '')}?text=Sua%20vaga%20abriu%20para%20a%20aula!` : null;
        showToast(msg, 'success', wppLink);
      }
    })
  });

  const pedirRemocaoHorario = (aId, h) => setConfirmDialog({
    show: true, title: 'Excluir Horário', message: `Deletar turma das ${h}?`, onConfirm: () => performAction('REMOVE_HORARIO', { horarioId: aId }, () => {
      setGradeMestre(p => p.filter(a => a.id !== aId));
      setDb(p => { const n = { ...p }; Object.keys(n).forEach(d => n[d] = n[d].filter(a => a.id !== aId)); return n; }); setConfirmDialog({ show: false });
    })
  });

  const pedirRemocaoLocacao = (locId, cliente) => setConfirmDialog({
    show: true, title: 'Cancelar Reserva', message: `Remover reserva de ${cliente}?`, onConfirm: () => performAction('REMOVE_LOCACAO', { locacaoId: locId }, () => {
      setTodasLocacoes(p => p.filter(l => l.id !== locId)); setConfirmDialog({ show: false });
    })
  });

  const getNivelColor = (n) => {
    switch (n) {
      case 'Categoria A': return 'bg-red-100 text-red-800 border-red-300';
      case 'Categoria B': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Categoria C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Categoria D': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FUN': return 'bg-[#91CA05]/20 text-[#012A1A] border-[#91CA05]';
      default: return 'bg-stone-100 text-stone-800';
    }
  };

  /* STREAMING_CHUNK:Processando Painel de Alunos... */
  const relatorioAlunos = useMemo(() => {
    if (!todasMatriculas) return [];

    const agrupado = todasMatriculas.reduce((acc, aluno) => {
      // PREVENÇÃO DE ERRO: Garante que o nome existe antes de usar toLowerCase
      const nomeOriginal = aluno.nome ? String(aluno.nome) : 'Atleta Sem Nome';
      const nomeKey = nomeOriginal.toLowerCase().trim();

      if (!acc[nomeKey]) {
        acc[nomeKey] = {
          nome: nomeOriginal,
          whatsapp: aluno.whatsapp || '',
          nivel: aluno.nivel || 'FUN',
          plano: aluno.plano || 'Avulso',
          totalAulas: 0,
          presencas: 0,
          checkins: 0
        };
      }

      acc[nomeKey].totalAulas++;
      if (aluno.presente) acc[nomeKey].presencas++;
      if (aluno.parceiroCheckin) acc[nomeKey].checkins++;

      // Atualiza com o plano e nível da matrícula mais recente
      acc[nomeKey].nivel = aluno.nivel || acc[nomeKey].nivel;
      acc[nomeKey].plano = aluno.plano || acc[nomeKey].plano;

      return acc;
    }, {});

    let lista = Object.values(agrupado).sort((a, b) => a.nome.localeCompare(b.nome));

    // Filtra pela busca se houver
    if (buscaAluno && buscaAluno.trim() !== '') {
      const termo = buscaAluno.toLowerCase().trim();
      lista = lista.filter(aluno => aluno.nome.toLowerCase().includes(termo));
    }

    return lista;
  }, [todasMatriculas, buscaAluno]);


  /* STREAMING_CHUNK:Renderizando a Interface... */
  return (
    <div className="min-h-screen bg-stone-100 font-sans pb-10 relative">
      {toast.show && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-lg flex items-center gap-3 font-bold text-sm text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-[#012A1A]'}`}>
          <Info className="h-4 w-4" /> {toast.message}
          {toast.actionLink && (
            <a href={toast.actionLink} target="_blank" rel="noreferrer" className="ml-2 bg-[#91CA05] text-[#012A1A] px-3 py-1 rounded-full text-xs uppercase hover:bg-white transition-colors">
              Avisar no WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Header */}
      <header className="bg-[#012A1A] text-white p-4 shadow-lg sticky top-0 z-40 border-b-[4px] border-[#91CA05]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="h-10 bg-white p-1 rounded-md" onError={(e) => e.target.style.display = 'none'} />
            <div>
              <h1 className="text-2xl font-bold text-[#91CA05] tracking-wide" style={{ fontFamily: "'Orbitron', sans-serif" }}>PERSONALYTTE</h1>
              <p className="text-gray-300 text-xs mt-0.5 flex items-center gap-2">Sistema de Gestão {loading && <span className="flex h-2 w-2 relative ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#91CA05] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#91CA05]"></span></span>}</p>
            </div>
          </div>

          {(activeTab === 'diario' || activeTab === 'locacao') && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#014227] p-1.5 rounded-xl">
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }} className="p-2 hover:bg-[#012A1A] rounded-lg transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                <div className="flex items-center gap-2 px-2 min-w-[160px] justify-center text-sm font-semibold capitalize"><Calendar className="h-4 w-4 text-[#91CA05]" /> {currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}</div>
                <button onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }} className="p-2 hover:bg-[#012A1A] rounded-lg transition-colors"><ChevronRight className="h-5 w-5" /></button>
                <button onClick={() => setCurrentDate(new Date())} className="ml-1 text-xs bg-[#91CA05] text-[#012A1A] px-3 py-1.5 rounded-lg font-bold hover:bg-white transition-colors">Hoje</button>
              </div>
              {activeTab === 'diario' && <button onClick={() => setIsConfigOpen(true)} className="p-2.5 bg-[#014227] hover:bg-[#91CA05] hover:text-[#012A1A] rounded-xl transition-colors ml-2" title="Adicionar Horário"><Settings className="h-5 w-5" /></button>}
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('diario')} className={`flex items-center gap-2 px-6 py-4 font-bold border-b-4 transition-colors whitespace-nowrap ${activeTab === 'diario' ? 'border-[#91CA05] text-[#012A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}><LayoutDashboard className="h-5 w-5" /> Diário de Aulas</button>
          <button onClick={() => setActiveTab('locacao')} className={`flex items-center gap-2 px-6 py-4 font-bold border-b-4 transition-colors whitespace-nowrap ${activeTab === 'locacao' ? 'border-[#91CA05] text-[#012A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}><Key className="h-5 w-5" /> Locação de Quadra</button>
          <button onClick={() => setActiveTab('painel')} className={`flex items-center gap-2 px-6 py-4 font-bold border-b-4 transition-colors whitespace-nowrap ${activeTab === 'painel' ? 'border-[#91CA05] text-[#012A1A]' : 'border-transparent text-stone-400 hover:text-stone-600'}`}><Users className="h-5 w-5" /> Painel de Alunos</button>
        </div>
      </div>

      {/* ABA DIÁRIO */}
      {activeTab === 'diario' && (
        <main className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6 animate-in fade-in">
          {gradeMestre.length === 0 && !loading && <div className="text-center p-10 bg-white rounded-2xl shadow-sm"><p className="text-stone-500 font-medium">Nenhuma aula. Clique na Engrenagem acima para criar a grade de aulas.</p></div>}

          {aulasDoDia.map((aula) => {
            const alunosUnicos = aula.alunos.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            const confirmados = alunosUnicos.filter(a => a.status === 'Confirmado');
            const filaEspera = alunosUnicos.filter(a => a.status === 'Espera');

            const slots = Array.from({ length: 4 }).map((_, i) => confirmados[i] || null);
            const isLotada = confirmados.length >= 4;

            return (
              <section key={aula.id} className="bg-white rounded-2xl shadow-md border-l-4 border-l-[#012A1A] overflow-hidden">
                <div className="bg-stone-50 border-b border-stone-200 p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#91CA05]/20 text-[#012A1A] p-2 rounded-lg"><Clock className="h-5 w-5" /></div>
                    <div>
                      <h2 className="text-xl font-bold text-[#012A1A] flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>{aula.horario} <button onClick={() => pedirRemocaoHorario(aula.id, aula.horario)} className="text-stone-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></h2>
                      <p className="text-stone-500 text-sm font-semibold">{aula.professor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-600 hidden md:inline">Ocupação:</span>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${isLotada ? 'bg-red-100 text-red-700' : 'bg-[#012A1A] text-[#91CA05]'}`}>{confirmados.length} / 4</div>
                    {isLotada && (
                      <button onClick={() => { setModalAulaId(aula.id); setEditandoAlunoId(null); setNovoAluno({ nome: '', whatsapp: '', nivel: 'FUN', plano: 'Avulso', recorrencia: '1' }); setIsModalOpen(true); }} className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm transition-colors ml-2">
                        + Fila de Espera
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-stone-200">
                  {slots.map((aluno, idx) => (
                    <div key={aluno ? aluno.id : `empty-${aula.id}-${idx}`} className="p-4 flex flex-col h-full min-h-[260px] relative group">
                      {aluno ? (
                        <>
                          <div className="absolute top-4 right-4 flex items-center gap-1">
                            <button onClick={() => abrirModalMover(aula.id, aluno)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Transferir de Horário">
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                            <button onClick={() => abrirEdicaoAluno(aula.id, aluno)} className="p-1.5 text-stone-400 hover:text-[#012A1A] hover:bg-stone-100 rounded-lg transition-colors" title="Editar Aluno">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => pedirRemocaoAluno(aula.id, aluno.id, aluno.nome)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remover Aluno">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex-1 pr-24">
                            <h3 className="font-bold text-lg text-[#012A1A] mb-3 line-clamp-1 uppercase">{aluno.nome}</h3>
                            <div className="flex flex-wrap gap-2 mb-4"><span className={`text-xs px-2 py-1 rounded-md font-bold border ${getNivelColor(aluno.nivel)}`}>{aluno.nivel}</span><span className="text-xs px-2 py-1 rounded-md font-bold border bg-stone-100 text-stone-600">{aluno.plano}</span></div>
                            <div className="flex items-center gap-2 text-stone-500 text-sm mb-4 font-medium"><Phone className="h-4 w-4" />{aluno.whatsapp || '---'}</div>
                          </div>
                          <div className="space-y-2 mt-auto">
                            <button onClick={() => togglePresenca(aula.id, aluno.id)} className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 ${aluno.presente ? 'bg-[#91CA05] text-[#012A1A] shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}><CheckCircle className={`h-5 w-5 ${aluno.presente ? 'text-[#012A1A]' : 'text-stone-400'}`} /> {aluno.presente ? 'Presente' : 'Dar Presença'}</button>
                            {(aluno.plano === 'Gympass' || aluno.plano === 'TotalPass') && (
                              <button onClick={() => toggleCheckin(aula.id, aluno.id)} className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border ${aluno.parceiroCheckin ? 'bg-[#012A1A] border-[#012A1A] text-white' : 'bg-white border-dashed border-[#012A1A] text-[#012A1A]'}`}>{aluno.parceiroCheckin ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {aluno.parceiroCheckin ? 'Check-in Validado' : 'Validar Check-in'}</button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3 bg-stone-50/50 rounded-xl border-2 border-dashed border-stone-200 p-4 cursor-pointer hover:border-[#91CA05] hover:text-[#012A1A]" onClick={() => { setModalAulaId(aula.id); setEditandoAlunoId(null); setNovoAluno({ nome: '', whatsapp: '', nivel: 'FUN', plano: 'Avulso', recorrencia: '1' }); setIsModalOpen(true); }}>
                          <div className="bg-white p-3 rounded-full shadow-sm"><UserPlus className="h-8 w-8 current-color" /></div><span className="font-semibold text-center">Vaga Disponível</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {filaEspera.length > 0 && (
                  <div className="bg-orange-50 border-t border-orange-200 p-4">
                    <h4 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Fila de Espera ({filaEspera.length})</h4>
                    <div className="flex gap-3 flex-wrap">
                      {filaEspera.map((esp, i) => (
                        <div key={esp.id} className="bg-white border border-orange-200 text-sm pl-3 pr-1 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                          <span className="font-bold text-orange-900 uppercase">{i + 1}. {esp.nome}</span>
                          <button onClick={() => pedirRemocaoAluno(aula.id, esp.id, esp.nome)} className="p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </main>
      )}

      {/* ABA LOCAÇÃO */}
      {activeTab === 'locacao' && (
        <main className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#012A1A]" style={{ fontFamily: "'Orbitron', sans-serif" }}>Reservas de Quadra</h2>
            <button onClick={() => setIsLocacaoModalOpen(true)} className="bg-[#012A1A] hover:bg-[#014227] text-[#91CA05] px-6 py-2.5 rounded-xl font-bold transition-colors shadow-md flex items-center gap-2">+ Nova Reserva</button>
          </div>
          {locacoesDoDia.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-dashed border-stone-300"><Key className="h-12 w-12 text-stone-300 mx-auto mb-4" /><p className="text-stone-500 font-medium">Nenhuma locação agendada para este dia.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {locacoesDoDia.map(loc => (
                <div key={loc.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 flex flex-col relative">
                  <button onClick={() => pedirRemocaoLocacao(loc.id, loc.nomeCliente)} className="absolute top-4 right-4 p-1.5 text-stone-300 hover:text-red-500 bg-stone-50 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                  <div className="flex items-center gap-3 mb-4"><div className="bg-[#91CA05]/20 text-[#012A1A] p-2.5 rounded-xl"><Clock className="h-5 w-5" /></div><span className="text-xl font-bold text-[#012A1A]" style={{ fontFamily: "'Orbitron', sans-serif" }}>{loc.horario}</span></div>
                  <div className="mb-6 flex-1"><h3 className="font-bold text-lg text-stone-800 uppercase line-clamp-1 mb-1">{loc.nomeCliente}</h3><div className="flex items-center gap-2 text-stone-500 text-sm font-medium"><Phone className="h-4 w-4" />{loc.whatsapp || 'Não informado'}</div></div>
                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-4"><div className="flex items-center gap-1.5 text-stone-600 font-bold bg-stone-100 px-3 py-1.5 rounded-lg"><Banknote className="h-4 w-4 text-[#91CA05] drop-shadow-sm" /> R$ {loc.valor}</div><button onClick={() => togglePagamentoLocacao(loc.id)} className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors border ${loc.pago ? 'bg-[#91CA05] text-[#012A1A] border-[#91CA05] shadow-sm' : 'bg-white text-stone-500 border-stone-300 hover:bg-stone-50'}`}>{loc.pago ? 'Pago' : 'Pendente'}</button></div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ABA PAINEL DE ALUNOS (DASHBOARD) */}
      {activeTab === 'painel' && (
        <main className="max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in">

          <div className="bg-[#012A1A] rounded-t-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-md border-b-4 border-[#91CA05]">
            <div className="text-center md:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-[#91CA05] mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>Base de Atletas</h2>
              <p className="text-gray-300 text-sm">Gerencie o histórico e o desempenho de todos os alunos da Arena.</p>
            </div>

            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-stone-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome..."
                className="w-full bg-white/10 border border-white/20 text-white placeholder-stone-400 rounded-xl py-3 pl-10 pr-4 outline-none focus:bg-white/20 focus:border-[#91CA05] transition-all"
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
              />
              {buscaAluno && (
                <button onClick={() => setBuscaAluno('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-stone-200 min-h-[400px]">
            {relatorioAlunos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                <Users className="h-16 w-16 mb-4 text-stone-300" />
                <p className="text-lg font-medium">{buscaAluno ? "Nenhum aluno encontrado com esse nome." : "Sua base de alunos está vazia."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatorioAlunos.map((aluno, i) => {
                  const percentual = aluno.totalAulas > 0 ? Math.round((aluno.presencas / aluno.totalAulas) * 100) : 0;

                  return (
                    <div key={i} className="border border-stone-200 rounded-2xl p-5 hover:border-[#91CA05] transition-colors bg-stone-50/50 flex flex-col group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-2">
                          <h3 className="text-xl font-bold text-[#012A1A] uppercase leading-tight">{aluno.nome}</h3>
                          <div className="flex items-center gap-1 mt-1 text-stone-500 text-sm"><Phone className="h-3 w-3" /> {aluno.whatsapp || '---'}</div>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${getNivelColor(aluno.nivel)}`}>{aluno.nivel}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-5 bg-white p-3 rounded-xl border border-stone-100 shadow-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-stone-700">{aluno.totalAulas}</div>
                          <div className="text-[10px] text-stone-500 uppercase font-semibold">Agendado</div>
                        </div>
                        <div className="text-center border-x border-stone-100">
                          <div className="text-2xl font-bold text-[#91CA05] drop-shadow-sm">{aluno.presencas}</div>
                          <div className="text-[10px] text-stone-500 uppercase font-semibold">Presenças</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{aluno.checkins}</div>
                          <div className="text-[10px] text-stone-500 uppercase font-semibold">Check-ins</div>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1"><Activity className="h-3 w-3" /> Assiduidade</span>
                          <span className={`text-sm font-bold ${percentual >= 75 ? 'text-green-600' : percentual >= 50 ? 'text-orange-500' : 'text-red-500'}`}>{percentual}%</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-2.5 rounded-full transition-all duration-1000 ${percentual >= 75 ? 'bg-green-500' : percentual >= 50 ? 'bg-orange-400' : 'bg-red-500'}`} style={{ width: `${percentual}%` }}></div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-stone-200 flex justify-between items-center text-xs font-semibold text-stone-500">
                          <span>Plano Atual: <span className="text-stone-800">{aluno.plano}</span></span>
                          {aluno.whatsapp && (
                            <a href={`https://wa.me/55${aluno.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Conversar</a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* MODAIS (Locação, Config, Aluno, Move) */}
      {isLocacaoModalOpen && (<div className="fixed inset-0 bg-[#012A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border-t-4 border-[#91CA05]"><div className="bg-[#012A1A] text-white p-4 flex justify-between items-center"><h3 className="font-bold text-lg text-[#91CA05]" style={{ fontFamily: "'Orbitron', sans-serif" }}>Nova Locação</h3><button onClick={() => setIsLocacaoModalOpen(false)} className="p-1 hover:text-[#91CA05]"><X className="h-5 w-5" /></button></div><form onSubmit={handleSalvarLocacao} className="p-6 flex flex-col gap-4"><div><label className="block text-xs font-bold text-[#012A1A] mb-1">Horário Reservado</label><input type="text" required placeholder="Ex: 09:00 - 10:30" className="w-full border-2 border-stone-200 rounded-lg p-2.5 font-bold outline-none focus:border-[#91CA05]" value={novaLocacao.horario} onChange={e => setNovaLocacao({ ...novaLocacao, horario: e.target.value })} /></div><div><label className="block text-xs font-bold text-[#012A1A] mb-1">Nome do Cliente / Turma</label><input type="text" required placeholder="Ex: Galera do João" className="w-full border-2 border-stone-200 rounded-lg p-2.5 uppercase font-bold outline-none focus:border-[#91CA05]" value={novaLocacao.nomeCliente} onChange={e => setNovaLocacao({ ...novaLocacao, nomeCliente: e.target.value })} /></div><div><label className="block text-xs font-bold text-[#012A1A] mb-1">WhatsApp de Contato</label><input type="text" placeholder="Ex: 11999999999" className="w-full border-2 border-stone-200 rounded-lg p-2.5 outline-none focus:border-[#91CA05]" value={novaLocacao.whatsapp} onChange={e => setNovaLocacao({ ...novaLocacao, whatsapp: e.target.value })} /></div><div><label className="block text-xs font-bold text-[#012A1A] mb-1">Valor Combinado (R$)</label><input type="number" required placeholder="Ex: 120" className="w-full border-2 border-stone-200 rounded-lg p-2.5 outline-none focus:border-[#91CA05] text-lg font-bold text-[#012A1A]" value={novaLocacao.valor} onChange={e => setNovaLocacao({ ...novaLocacao, valor: e.target.value })} /></div><button type="submit" disabled={loading} className="w-full py-3.5 bg-[#91CA05] text-[#012A1A] font-bold rounded-xl mt-2 hover:bg-[#a5e00b] transition-colors shadow-md">{loading ? 'Processando...' : 'Confirmar Reserva'}</button></form></div></div>)}
      {isConfigOpen && (<div className="fixed inset-0 bg-[#012A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border-t-4 border-[#91CA05]"><div className="bg-[#012A1A] text-white p-4 flex justify-between items-center"><h3 className="font-bold text-lg text-[#91CA05]" style={{ fontFamily: "'Orbitron', sans-serif" }}>Nova Turma (Grade Base)</h3><button onClick={() => setIsConfigOpen(false)} className="p-1 hover:text-[#91CA05]"><X className="h-5 w-5" /></button></div><form onSubmit={handleAdicionarHorario} className="p-6 flex flex-col gap-4"><div><label className="block text-sm font-bold text-[#012A1A] mb-1">Horário</label><input type="text" autoFocus required placeholder="Ex: 10:00 - 11:00" className="w-full border-2 border-stone-200 rounded-lg p-2.5 outline-none focus:border-[#91CA05]" value={novoHorario.horario} onChange={e => setNovoHorario({ ...novoHorario, horario: e.target.value })} /></div><div><label className="block text-sm font-bold text-[#012A1A] mb-1">Professor(a)</label><input type="text" required placeholder="Ex: Prof. Carlos" className="w-full border-2 border-stone-200 rounded-lg p-2.5 outline-none focus:border-[#91CA05]" value={novoHorario.professor} onChange={e => setNovoHorario({ ...novoHorario, professor: e.target.value })} /></div><button type="submit" disabled={loading} className="w-full py-3 bg-[#012A1A] text-[#91CA05] font-bold rounded-xl mt-2 hover:bg-[#014227] transition-colors">{loading ? 'Salvando...' : 'Adicionar à Grade'}</button></form></div></div>)}
      {isModalOpen && (<div className="fixed inset-0 bg-[#012A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md overflow-hidden border-t-4 border-[#91CA05]"><div className="bg-stone-50 border-b border-stone-200 p-4 flex justify-between items-center"><h3 className="font-bold text-[#012A1A] text-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>{editandoAlunoId ? 'Editar Aluno' : 'Encaixar Aluno'}</h3><button onClick={() => { setIsModalOpen(false); setEditandoAlunoId(null); }} className="p-1 text-stone-400 hover:text-stone-800"><X className="h-5 w-5" /></button></div><form onSubmit={handleSalvarAluno} className="p-6 flex flex-col gap-4"><input type="text" autoFocus required placeholder="Nome do Aluno" className="w-full border-2 border-stone-200 rounded-lg p-3 font-semibold outline-none focus:border-[#91CA05] uppercase" value={novoAluno.nome} onChange={e => setNovoAluno({ ...novoAluno, nome: e.target.value })} /><input type="text" placeholder="WhatsApp (Opcional)" className="w-full border-2 border-stone-200 rounded-lg p-3 font-semibold outline-none focus:border-[#91CA05]" value={novoAluno.whatsapp} onChange={e => setNovoAluno({ ...novoAluno, whatsapp: e.target.value })} /><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-stone-500 mb-1">Categoria</label><select className="w-full border-2 border-stone-200 rounded-lg p-3 font-semibold outline-none focus:border-[#91CA05]" value={novoAluno.nivel} onChange={e => setNovoAluno({ ...novoAluno, nivel: e.target.value })}><option>FUN</option><option>Categoria D</option><option>Categoria C</option><option>Categoria B</option><option>Categoria A</option></select></div><div><label className="block text-xs font-bold text-stone-500 mb-1">Plano</label><select className="w-full border-2 border-stone-200 rounded-lg p-3 font-semibold outline-none focus:border-[#91CA05]" value={novoAluno.plano} onChange={e => setNovoAluno({ ...novoAluno, plano: e.target.value })}><option>Mensalista</option><option>Avulso</option><option>Gympass</option><option>TotalPass</option></select></div></div>{!editandoAlunoId && <div className="p-3 bg-[#91CA05]/20 border border-[#91CA05] rounded-lg mt-2"><label className="block text-xs font-bold text-[#012A1A] mb-2">REPETIÇÃO AUTOMÁTICA</label><select className="w-full bg-white border border-stone-200 rounded-lg p-2 font-semibold outline-none text-sm" value={novoAluno.recorrencia} onChange={e => setNovoAluno({ ...novoAluno, recorrencia: e.target.value })}><option value="1">Apenas nesta data (Sem repetição)</option><option value="4">Repetir por 1 Mês (4 semanas)</option><option value="12">Repetir por 3 Meses (12 semanas)</option></select></div>}<button type="submit" disabled={loading} className="w-full py-3.5 bg-[#91CA05] text-[#012A1A] font-bold rounded-xl mt-2 hover:bg-[#a5e00b] transition-colors shadow-md">{loading ? 'Salvando...' : (editandoAlunoId ? 'Salvar Alterações' : 'Confirmar Vaga')}</button></form></div></div>)}
      {isMoveModalOpen && (<div className="fixed inset-0 bg-[#012A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border-t-4 border-blue-500"><div className="bg-stone-50 border-b border-stone-200 p-4 flex justify-between items-center"><h3 className="font-bold text-[#012A1A] text-lg flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif" }}><ArrowRightLeft className="h-5 w-5 text-blue-500" /> Transferir</h3><button onClick={() => setIsMoveModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-800"><X className="h-5 w-5" /></button></div><form onSubmit={handleMoverAluno} className="p-6 flex flex-col gap-4"><p className="text-sm font-medium text-stone-600 mb-2">Para qual horário você deseja mover <strong>{moveInfo.nome}</strong> hoje?</p><select required className="w-full border-2 border-stone-200 rounded-lg p-3 font-bold outline-none focus:border-blue-500 text-[#012A1A]" value={moveInfo.toAulaId} onChange={e => setMoveInfo({ ...moveInfo, toAulaId: e.target.value })}><option value="" disabled>Selecione a nova turma...</option>{aulasDoDia.filter(a => a.id !== moveInfo.fromAulaId).map(aula => (<option key={aula.id} value={aula.id}>{aula.horario} ({aula.professor})</option>))}</select><button type="submit" disabled={loading || !moveInfo.toAulaId} className="w-full py-3.5 bg-blue-500 text-white font-bold rounded-xl mt-2 hover:bg-blue-600 transition-colors shadow-md disabled:bg-stone-300">{loading ? 'Transferindo...' : 'Confirmar Transferência'}</button></form></div></div>)}
      {confirmDialog.show && (<div className="fixed inset-0 bg-[#012A1A]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full border-t-4 border-red-500"><h3 className="font-bold text-lg mb-2 text-[#012A1A]" style={{ fontFamily: "'Orbitron', sans-serif" }}>{confirmDialog.title}</h3><p className="text-stone-500 font-medium text-sm mb-6">{confirmDialog.message}</p><div className="flex gap-3"><button onClick={() => setConfirmDialog({ show: false })} className="flex-1 py-2.5 bg-stone-100 font-bold text-stone-600 rounded-xl hover:bg-stone-200">Cancelar</button><button onClick={confirmDialog.onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md">Sim, remover</button></div></div></div>)}
    </div>
  );
}

