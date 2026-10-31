import { useEffect, useRef } from 'react';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { useNotificationStore } from '@/stores/notification-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useOllamaHealth } from '@/api/ollama';

/** Anuncia mudanças de conexão sem notificar eventos normais do chat. */
export function ConnectionNotifier() {
  const online = useOnlineStatus();
  const offlineMode = useConnectionStore((state) => state.mode === 'offline');
  const ollama = useOllamaHealth();
  const serviceOnline = offlineMode ? !ollama.isError && !ollama.isLoading : online;
  const previous = useRef(serviceOnline);
  const add = useNotificationStore((state) => state.add);

  useEffect(() => {
    if (previous.current === serviceOnline) {
      return;
    }

    previous.current = serviceOnline;

    if (serviceOnline) {
      add({
        tone: 'success',
        title: 'Conexão restabelecida',
        message: offlineMode ? 'O Ollama local voltou a responder.' : 'A NEXA voltou a responder.',
      });
      return;
    }

    add({
      tone: 'warning',
      title: offlineMode ? 'Ollama indisponível' : 'Sem conexão',
      message: offlineMode ? 'Inicie o Ollama com “ollama serve”.' : 'As respostas podem ficar indisponíveis até a rede voltar.',
    });
  }, [add, offlineMode, serviceOnline]);

  return null;
}
