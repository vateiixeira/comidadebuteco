// =====================================================================
// Comida di Buteco — App principal (Vue 3 sem build)
// =====================================================================
const { createApp, ref, computed, onMounted } = Vue;

const sb = window.supabase.createClient(
  window.CDB_CONFIG.SUPABASE_URL,
  window.CDB_CONFIG.SUPABASE_ANON_KEY
);

const NOTA_LABELS = ['', 'fugiu...', 'meia boca', 'mais ou menos', 'muito bom!', 'trem da gota!'];

function formatarTelefone(digits) {
  const d = (digits || '').slice(0, 11);
  if (!d) return '';
  if (d.length < 3) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatarDistancia(m) {
  if (m == null || isNaN(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatarTempoRelativo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

createApp({
  setup() {
    // ----- estado -----
    const dishes = window.CDB_DISHES;
    const dishById = new Map(dishes.map(d => [d.id, d]));
    const user = ref(null);
    const ratings = ref({}); // { prato_id: {nota, obs, atualizado_em} }
    const filtro = ref('faltam');
    const aberto = ref(null);

    const telefoneInput = ref(''); // guarda só dígitos
    const nomeInput = ref('');
    const precisaNome = ref(false);
    const erroLogin = ref('');
    const carregandoLogin = ref(false);
    const carregandoApp = ref(true);

    const notaInput = ref(0);
    const obsInput = ref('');
    const carregandoModal = ref(false);
    const carregandoShare = ref(false);

    const userLocation = ref(null); // {lat, lng} ou null
    const obtendoLocal = ref(false);
    const erroLocal = ref('');

    const feedAvaliacoes = ref([]);
    const carregandoFeed = ref(false);
    const erroFeed = ref('');
    const agregadosAvaliacoes = ref([]);

    const toast = ref(null); // { msg, tipo } ou null
    let toastTimer = null;

    // ----- computeds -----
    const stats = computed(() => {
      const visitados = Object.keys(ratings.value).length;
      return {
        visitados,
        total: dishes.length,
        faltam: dishes.length - visitados,
        progresso: dishes.length ? (visitados / dishes.length) * 100 : 0,
      };
    });

    const lista = computed(() => {
      if (filtro.value === 'jafui') return dishes.filter(d => ratings.value[d.id]);
      if (filtro.value === 'faltam') {
        return dishes
          .filter(d => !ratings.value[d.id])
          .sort((a, b) => {
            const ma = mediasPorPrato.value.get(a.id)?.media ?? -1;
            const mb = mediasPorPrato.value.get(b.id)?.media ?? -1;
            return mb - ma;
          });
      }
      if (filtro.value === 'perto' && userLocation.value) {
        const { lat, lng } = userLocation.value;
        return dishes
          .map(d => ({ ...d, _dist: haversineM(lat, lng, d.lat, d.lng) }))
          .sort((a, b) => a._dist - b._dist);
      }
      return dishes;
    });

    const feedEnriquecido = computed(() =>
      feedAvaliacoes.value.map(a => {
        const d = dishById.get(a.prato_id);
        return {
          ...a,
          nome: a.usuarios?.nome || 'alguém',
          prato: d?.prato || '',
          boteco: d?.boteco || '',
          foto: d?.foto || '',
          tempoRel: formatarTempoRelativo(a.atualizado_em),
        };
      })
    );

    const mediasPorPrato = computed(() => {
      const acc = new Map();
      for (const a of agregadosAvaliacoes.value) {
        const cur = acc.get(a.prato_id) || { soma: 0, contagem: 0 };
        cur.soma += a.nota;
        cur.contagem += 1;
        acc.set(a.prato_id, cur);
      }
      const saida = new Map();
      for (const [id, { soma, contagem }] of acc) {
        saida.set(id, { media: soma / contagem, contagem });
      }
      return saida;
    });

    const notaLabel = computed(() => NOTA_LABELS[notaInput.value] || '');

    const telefoneFormatado = computed(() => formatarTelefone(telefoneInput.value));

    // ----- helpers -----
    function mostrarToast(msg, tipo = 'sucesso') {
      toast.value = { msg, tipo };
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.value = null; }, 4000);
    }

    function telefoneValido(t) {
      return /^\d{11}$/.test(t);
    }

    function handleTelefoneInput(ev) {
      telefoneInput.value = ev.target.value.replace(/\D/g, '').slice(0, 11);
      precisaNome.value = false;
      erroLogin.value = '';
    }

    async function selecionarPerto() {
      erroLocal.value = '';
      if (!navigator.geolocation) {
        erroLocal.value = 'Seu navegador não suporta geolocalização.';
        return;
      }
      obtendoLocal.value = true;
      try {
        const pos = await new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        userLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        filtro.value = 'perto';
      } catch (e) {
        if (e.code === 1) erroLocal.value = 'Libera a localização pra gente ordenar por distância.';
        else if (e.code === 3) erroLocal.value = 'Demorou demais pra pegar sua localização.';
        else erroLocal.value = 'Não rolou pegar sua localização.';
      } finally {
        obtendoLocal.value = false;
      }
    }

    async function carregarFeed() {
      carregandoFeed.value = true;
      erroFeed.value = '';
      try {
        const { data, error } = await sb
          .from('avaliacoes')
          .select('telefone, prato_id, nota, obs, atualizado_em, usuarios(nome)')
          .order('atualizado_em', { ascending: false });
        if (error) throw error;
        feedAvaliacoes.value = data || [];
      } catch (e) {
        console.error('carregarFeed', e);
        erroFeed.value = 'Deu ruim ao carregar. Tenta de novo.';
      } finally {
        carregandoFeed.value = false;
      }
    }

    async function carregarAgregados() {
      const { data, error } = await sb
        .from('avaliacoes')
        .select('prato_id, nota');
      if (error) {
        console.error('carregarAgregados', error);
        return;
      }
      agregadosAvaliacoes.value = data || [];
    }

    function selecionarGalera() {
      filtro.value = 'galera';
      carregarFeed();
    }

    async function carregarRatings(telefone) {
      const { data, error } = await sb
        .from('avaliacoes')
        .select('*')
        .eq('telefone', telefone);
      if (error) {
        console.error('carregarRatings', error);
        return;
      }
      const map = {};
      for (const r of (data || [])) map[r.prato_id] = r;
      ratings.value = map;
    }

    // ----- ações -----
    async function handleLogin() {
      erroLogin.value = '';
      const telefone = telefoneInput.value;
      if (!telefoneValido(telefone)) {
        erroLogin.value = 'Celular inválido. Precisa ter DDD + 9 dígitos.';
        return;
      }
      carregandoLogin.value = true;
      try {
        const { data: existente, error: errBusca } = await sb
          .from('usuarios')
          .select('*')
          .eq('telefone', telefone)
          .maybeSingle();

        if (errBusca) throw errBusca;

        if (existente) {
          user.value = existente;
          localStorage.setItem('cdb_telefone', telefone);
          await carregarRatings(telefone);
          carregandoLogin.value = false;
          return;
        }

        if (!precisaNome.value) {
          precisaNome.value = true;
          carregandoLogin.value = false;
          return;
        }

        if (nomeInput.value.trim().length < 2) {
          erroLogin.value = 'Coloca seu nome aí, parceiro.';
          carregandoLogin.value = false;
          return;
        }

        const { data: novo, error: errInsert } = await sb
          .from('usuarios')
          .insert({ telefone, nome: nomeInput.value.trim() })
          .select()
          .single();

        if (errInsert) throw errInsert;

        user.value = novo;
        localStorage.setItem('cdb_telefone', telefone);
        carregandoLogin.value = false;
      } catch (e) {
        console.error(e);
        erroLogin.value = 'Deu ruim: ' + (e.message || String(e));
        carregandoLogin.value = false;
      }
    }

    function handleLogout() {
      localStorage.removeItem('cdb_telefone');
      user.value = null;
      ratings.value = {};
      telefoneInput.value = '';
      nomeInput.value = '';
      precisaNome.value = false;
      erroLogin.value = '';
    }

    function abrirModal(dish) {
      aberto.value = dish;
      const r = ratings.value[dish.id];
      notaInput.value = r ? r.nota : 0;
      obsInput.value = r ? (r.obs || '') : '';
    }

    function fecharModal() {
      aberto.value = null;
      notaInput.value = 0;
      obsInput.value = '';
    }

    async function salvarRating() {
      if (notaInput.value < 1) return;
      carregandoModal.value = true;
      const dados = {
        telefone: user.value.telefone,
        prato_id: aberto.value.id,
        nota: notaInput.value,
        obs: obsInput.value.trim(),
        atualizado_em: new Date().toISOString(),
      };
      const { data, error } = await sb
        .from('avaliacoes')
        .upsert(dados, { onConflict: 'telefone,prato_id' })
        .select()
        .single();
      if (error) {
        alert('Falha ao salvar:\n' + error.message);
        carregandoModal.value = false;
        return;
      }
      ratings.value = { ...ratings.value, [aberto.value.id]: data };
      fecharModal();
      carregandoModal.value = false;
    }

    async function apagarRating() {
      if (!confirm('Apagar essa avaliação?')) return;
      carregandoModal.value = true;
      const { error } = await sb
        .from('avaliacoes')
        .delete()
        .eq('telefone', user.value.telefone)
        .eq('prato_id', aberto.value.id);
      if (error) {
        alert('Falha ao apagar:\n' + error.message);
        carregandoModal.value = false;
        return;
      }
      const novo = { ...ratings.value };
      delete novo[aberto.value.id];
      ratings.value = novo;
      fecharModal();
      carregandoModal.value = false;
    }

    async function compartilharAvaliacaoAtual() {
      if (!aberto.value || !ratings.value[aberto.value.id]) return;
      const r = ratings.value[aberto.value.id];
      const dish = aberto.value;
      carregandoShare.value = true;
      try {
        const res = await window.CDB_SHARE.compartilharAvaliacao({
          nome: user.value.nome,
          boteco: dish.boteco,
          prato: dish.prato,
          nota: r.nota,
          obs: r.obs,
          foto: dish.foto,
        });
        if (res.metodo === 'download') {
          mostrarToast('imagem salva! abre o insta e posta como story', 'sucesso');
        }
      } catch (e) {
        console.error('compartilhar', e);
        mostrarToast('deu ruim ao gerar a imagem', 'erro');
      } finally {
        carregandoShare.value = false;
      }
    }

    // ----- mount: tenta auto-login com telefone salvo no device -----
    onMounted(async () => {
      carregarAgregados();
      const telSalvo = localStorage.getItem('cdb_telefone');
      if (!telSalvo) {
        carregandoApp.value = false;
        return;
      }
      try {
        const { data, error } = await sb
          .from('usuarios')
          .select('*')
          .eq('telefone', telSalvo)
          .maybeSingle();
        if (!error && data) {
          user.value = data;
          await carregarRatings(telSalvo);
        }
      } catch (e) {
        console.error('auto-login falhou', e);
      } finally {
        carregandoApp.value = false;
      }
    });

    return {
      // state
      user, ratings, filtro, aberto,
      telefoneInput, nomeInput, precisaNome, erroLogin, carregandoLogin, carregandoApp,
      notaInput, obsInput, carregandoModal, carregandoShare,
      userLocation, obtendoLocal, erroLocal,
      feedAvaliacoes, carregandoFeed, erroFeed, agregadosAvaliacoes,
      toast,
      // computed
      stats, lista, feedEnriquecido, mediasPorPrato, notaLabel, telefoneFormatado,
      // actions
      handleLogin, handleLogout, handleTelefoneInput,
      abrirModal, fecharModal, salvarRating, apagarRating, compartilharAvaliacaoAtual,
      selecionarPerto,
      carregarFeed, selecionarGalera,
      // helpers expostos
      formatarDistancia,
    };
  },
}).mount('#app');
