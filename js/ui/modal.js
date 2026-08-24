/**
 * 弹窗与轻提示（规则说明 / 确认框 / 错误提示 / toast）。
 * 仅负责 DOM 展示与事件绑定，不含业务规则。
 */

const overlay = document.getElementById('modalOverlay');
const titleEl = document.getElementById('modalTitle');
const bodyEl = document.getElementById('modalBody');
const actionsEl = document.getElementById('modalActions');
const closeBtn = document.getElementById('modalClose');
const toastEl = document.getElementById('toast');

let toastTimer = null;
let onCloseHandler = null;

/**
 * 打开弹窗。
 * @param {{title?:string, body?:string|Node, actions?:Array<{text:string, className?:string, onClick?:Function, close?:boolean}>, onClose?:Function}} opts
 */
export function showModal({ title = '', body = '', actions = [], onClose } = {}) {
  titleEl.textContent = title;
  bodyEl.innerHTML = '';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof Node) {
    bodyEl.appendChild(body);
  }
  actionsEl.innerHTML = '';
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = `btn ${a.className || ''}`.trim();
    btn.textContent = a.text || '确定';
    btn.addEventListener('click', () => {
      if (a.onClick) a.onClick();
      if (a.close !== false) closeModal();
    });
    actionsEl.appendChild(btn);
  }
  onCloseHandler = onClose || null;
  overlay.classList.add('active');
}

export function closeModal() {
  overlay.classList.remove('active');
  if (onCloseHandler) {
    const fn = onCloseHandler;
    onCloseHandler = null;
    fn();
  }
}

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

/** 确认框 */
export function showConfirm({ title = '确认', message = '', confirmText = '确认', cancelText = '取消', onConfirm, danger = false } = {}) {
  showModal({
    title,
    body: `<p>${message}</p>`,
    actions: [
      { text: cancelText, className: 'btn-ghost', onClick: () => {} },
      { text: confirmText, className: danger ? 'btn-danger' : 'btn-primary', onClick: onConfirm },
    ],
  });
}

/** 轻提示（错误/成功/信息） */
export function showToast(message, type = 'info', duration = 2200) {
  toastEl.textContent = message;
  toastEl.className = `toast ${type}`;
  void toastEl.offsetWidth; // 强制重排以重启动画
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

const RULES_HTML = `
  <h4>目标</h4>
  <p>在灰雾笼罩的海面下钓起恐怖之物，对局结束时钓获分值最高者获胜。</p>
  <h4>组件与开局</h4>
  <ul>
    <li>18 张鱼卡洗乱后分成 6 个浅滩，每堆 3 张（牌面朝下）。</li>
    <li>保证至少 3 个浅滩顶牌是"小阴影"（所需钩数 ≤ 0 的小鱼）。</li>
  </ul>
  <h4>回合流程</h4>
  <ul>
    <li><strong>能力阶段</strong>：可发动任意数量已钓能力鱼的能力（每次发动后该鱼横置，整局仅一次）。</li>
    <li><strong>抽牌</strong>：从任意浅滩取 2 张（可同一或不同浅滩）。</li>
    <li><strong>钓走/放回</strong>：若钩数足够，钓走 1 张；其余放回浅滩。每回合最多钓 1 条。</li>
  </ul>
  <h4>钩数</h4>
  <p>初始钩数 0；钓到的鱼会提供钩数（小鱼 1 钩，越大越多），当前钩数 = 已钓获鱼提供的钩数之和，用于满足更强鱼的要求。</p>
  <h4>放回规则</h4>
  <ul>
    <li>有可钓走的鱼时，必须先钓走一条，之后才能放回。</li>
    <li>放回优先放入空浅滩；否则盖在"大阴影"（顶牌钩数 ≥ 1）之上。</li>
    <li>除非所有浅滩顶牌都是小阴影，否则不能盖小阴影。</li>
  </ul>
  <h4>终局与计分</h4>
  <ul>
    <li>全部鱼被钓光，或无人能钓起剩余可接触的鱼时对局结束。</li>
    <li>计分 = 钓获分值之和；钓到最多"污秽鱼"的玩家额外 -2 分（并列都扣）。</li>
    <li>总分最高者胜；并列最高者共享胜局（平局）。</li>
  </ul>
`;

/** 规则说明弹窗 */
export function showRules() {
  showModal({ title: '规则说明', body: RULES_HTML, actions: [{ text: '知道了' }] });
}
