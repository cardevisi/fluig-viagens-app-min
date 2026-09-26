# Processos em Sistemas Operacionais

Um **processo** é um programa de computador em execução. Ele vai além do código estático gravado no disco (o programa em si), englobando todos os recursos necessários para a sua execução, como memória, registradores da CPU e o estado atual do sistema.

---

## 1. Estrutura de um Processo
Cada processo possui seu próprio espaço isolado no sistema, composto por três partes principais:

*   **Contexto de Software:** Define as regras de funcionamento e identificação do processo. Inclui o **PID** (Process ID), a identidade do usuário criador, prioridade de execução e limites de recursos.
*   **Contexto de Hardware:** Guarda o estado dos registradores da CPU quando o processo é pausado, incluindo o *Program Counter* (PC), que aponta para a próxima instrução a ser executada.
*   **Espaço de Endereçamento:** É a área de memória reservada para o processo. Divide-se em:
    *   **Code/Text:** Onde fica o código binário a ser executado.
    *   **Data:** Variáveis globais e estáticas do programa.
    *   **Heap:** Memória alocada dinamicamente durante a execução.
    *   **Stack (Pilha):** Variáveis locais e funções chamadas.

---

## 2. Ciclo de Vida e Estados do Processo
Para otimizar o uso do processador, o sistema operacional altera o estado dos processos continuamente. Os três estados fundamentais são:

1.  **Pronto (Ready):** O processo tem tudo o que precisa e está na fila aguardando a CPU liberá-lo para rodar.
2.  **Em Execução (Running):** As instruções do processo estão sendo ativamente processadas pela CPU.
3.  **Bloqueado/Em Espera (Blocked/Waiting):** O processo foi pausado porque depende de um evento externo, como uma operação de Entrada/Saída (E/S) ou a leitura de um arquivo no disco.

### Transições de Estado Comuns:
*   **Pronto $\rightarrow$ Em Execução:** O escalonador escolhe o processo para rodar.
*   **Em Execução $\rightarrow$ Pronto:** O tempo do processo na CPU acabou (Preempção).
*   **Em Execução $\rightarrow$ Bloqueado:** O processo solicitou um dado e precisa esperar o hardware responder.
*   **Bloqueado $\rightarrow$ Pronto:** O dado solicitado chegou e o processo volta para a fila de espera da CPU.

---

## 3. O Bloco de Controle de Processo (PCB)
O **PCB (Process Control Block)** é a estrutura de dados que o sistema operacional usa para gerenciar cada processo individualmente. Quando ocorre uma **troca de contexto** (a CPU muda de um processo para outro), o sistema operacional salva as informações do processo antigo no seu respectivo PCB e carrega os dados do novo processo a partir do PCB dele.

---

## 4. Processo vs. Thread

A tabela abaixo resume a principal diferença entre esses dois conceitos de execução:

| Característica | Processo | Thread |
| :--- | :--- | :--- |
| **Definição** | Unidade independente de alocação de recursos. | Unidade básica de execução da CPU dentro de um processo. |
| **Isolamento** | Totalmente isolado. Um processo não acessa a memória de outro facilmente. | Compartilha o espaço de memória e recursos com outras threads do mesmo processo. |
| **Criação e Troca** | Pesada e lenta (consome mais recursos). | Leve e rápida (troca de contexto simplificada). |
| **Falhas** | Se um processo trava, os outros continuam funcionando. | Se uma thread trava ou gera erro grave, pode derrubar o processo inteiro. |
