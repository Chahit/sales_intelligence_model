import os
import sys

import streamlit as st
import streamlit.components.v1 as components

# Link to backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ml_engine.sales_model import SalesIntelligenceEngine

from styles import apply_global_styles

# Import Tabs
from tabs import (
    clustering,
    competitor_intel,
    inventory,
    market_basket,
    monitoring,
    partner_360,
    product_lifecycle,
    recommendation_hub,
    sales_rep_performance,
)

# --- PAGE SETUP ---
st.set_page_config(
    page_title="Consistent AI Suite",
    layout="wide",
    page_icon=":chart_with_upwards_trend:",
)

apply_global_styles()

# --- FULL WIDTH CSS (base attempt — components.html will reinforce after Streamlit loads) ---
st.markdown("""
<style>
.block-container,
[data-testid="stMainBlockContainer"],
section.main .block-container {
    max-width: 100% !important;
    width: 100% !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
    padding-top: 1.5rem !important;
}
</style>
""", unsafe_allow_html=True)


# --- INITIALIZE ENGINE ---
@st.cache_resource
def get_engine():
    engine = SalesIntelligenceEngine()
    engine.load_data(lightweight=True)
    return engine


try:
    ai = get_engine()
except Exception as e:
    st.error(f"Engine Failure: {e}")
    st.stop()


# --- SIDEBAR ---
st.sidebar.markdown(
    "<div style='padding:10px 0 4px 0'>"
    "<span style='font-size:18px;font-weight:700;color:#fff;letter-spacing:0.02em'>Consistent AI</span>"
    "<br><span style='font-size:11px;color:#666;'>Sales Intelligence Suite</span>"
    "</div>",
    unsafe_allow_html=True,
)
st.sidebar.markdown("---")

if st.sidebar.button("⟳ Refresh Data"):
    st.cache_resource.clear()
    st.rerun()

nav = st.sidebar.radio(
    "Module",
    [
        "Partner 360 View",
        "Product Bundles (MBA)",
        "Inventory Liquidation",
        "Cluster Intelligence",
        "Product Lifecycle",
        "Recommendation Hub",
        "Competitor Intelligence",
        "Model Monitoring",
        "Sales Rep Performance",
    ],
)


# --- CHAT STATE ---
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# Hidden form — receives messages from the floating chat panel
with st.form("_chat_form", clear_on_submit=True):
    _chat_input = st.text_input("_msg", label_visibility="collapsed", key="_chat_msg_val")
    _chat_submitted = st.form_submit_button("_send", )

if _chat_submitted and str(_chat_input).strip():
    q = str(_chat_input).strip()
    st.session_state.chat_history.append({"role": "user", "content": q})
    answer = ai.chat_with_ai(q, history=st.session_state.chat_history[:-1])
    st.session_state.chat_history.append({"role": "assistant", "content": answer})
    st.rerun()

# Build escaped chat messages for injection
def _escape(s):
    return str(s).replace("\\", "\\\\").replace("`", "\\`").replace("</", "<\\/")

msgs_js_array = "["
for m in st.session_state.chat_history[-20:]:
    role = "user" if m["role"] == "user" else "ai"
    content = _escape(m["content"])
    msgs_js_array += f'{{role:"{role}",content:`{content}`}},'
msgs_js_array += "]"

groq_ok = bool(ai.groq_api_key or os.getenv("GROQ_API_KEY", ""))
quick_prompts_js = str([q.replace('"', '\\"') for q in ai.get_quick_insights()])

# --- INJECT FLOATING CHATBOT via components.html (JS runs in iframe, modifies parent) ---
components.html(f"""
<script>
(function() {{
  var par = window.parent.document;

  // ── Remove stale injected elements on hot reload ──────────────────────────
  ['_ai_style','_ai_bubble','_ai_panel'].forEach(function(id) {{
    var el = par.getElementById(id);
    if (el) el.parentNode.removeChild(el);
  }});

  // ── Inject CSS into parent head ───────────────────────────────────────────
  var style = par.createElement('style');
  style.id = '_ai_style';
  style.textContent = `
    /* ── FULL WIDTH OVERRIDE — injected after Streamlit CSS ────────────────── */
    .block-container,
    [data-testid="stMainBlockContainer"],
    section.main .block-container,
    div.stMainBlockContainer {{
      max-width: none !important;
      width: 100% !important;
      padding-left: 2rem !important;
      padding-right: 2rem !important;
    }}
    /* ── Floating chatbot ────────────────────────────────────────────────────── */
    #_ai_bubble {{
      position:fixed; bottom:28px; right:28px; width:52px; height:52px;
      border-radius:50%; background:#2563eb; color:#fff; font-size:22px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; box-shadow:0 4px 20px rgba(37,99,235,.5);
      z-index:2147483646; user-select:none; transition:transform .15s;
    }}
    #_ai_bubble:hover {{ transform:scale(1.1); }}
    #_ai_panel {{
      position:fixed; bottom:92px; right:28px; width:370px; max-height:540px;
      background:#141414; border:1px solid #222; border-radius:14px;
      box-shadow:0 8px 40px rgba(0,0,0,.7); z-index:2147483645;
      display:none; flex-direction:column; overflow:hidden; font-family:inherit;
    }}
    #_ai_panel.open {{ display:flex; }}
    #_ai_hdr {{
      background:#1a1a1a; padding:12px 16px; border-bottom:1px solid #222;
      display:flex; align-items:center; justify-content:space-between;
      font-weight:600; font-size:14px; color:#fff;
    }}
    #_ai_close {{ cursor:pointer; font-size:18px; color:#666; line-height:1; }}
    #_ai_close:hover {{ color:#fff; }}
    #_ai_msgs {{
      flex:1; overflow-y:auto; padding:12px 14px;
      display:flex; flex-direction:column; gap:8px;
    }}
    .ai-msg-u {{
      align-self:flex-end; background:#1e3a5f; color:#e8f4fd;
      padding:8px 12px; border-radius:12px 12px 2px 12px;
      max-width:82%; font-size:13px; line-height:1.45; word-break:break-word;
    }}
    .ai-msg-a {{
      align-self:flex-start; background:#0d1f0d; color:#c8f0c8;
      padding:8px 12px; border-radius:12px 12px 12px 2px;
      border-left:3px solid #22c55e;
      max-width:88%; font-size:13px; line-height:1.45; white-space:pre-wrap; word-break:break-word;
    }}
    .ai-msg-hint {{ color:#555; font-size:12px; font-style:italic; padding:4px 0; }}
    #_ai_quick {{
      padding:6px 12px 4px; display:flex; flex-wrap:wrap; gap:5px;
      border-top:1px solid #1e1e1e;
    }}
    .ai-qbtn {{
      background:#1a2a3a; color:#7eb8f0; border:1px solid #1e3a5f;
      border-radius:20px; padding:3px 9px; font-size:11px; cursor:pointer;
    }}
    .ai-qbtn:hover {{ background:#1e3a5f; color:#fff; }}
    #_ai_inp_area {{
      padding:10px 12px; border-top:1px solid #1e1e1e;
      display:flex; gap:7px; align-items:flex-end;
    }}
    #_ai_textarea {{
      flex:1; background:#1a1a1a; color:#e8e8e8; border:1px solid #2a2a2a;
      border-radius:8px; padding:8px 10px; font-size:13px;
      resize:none; min-height:38px; max-height:96px; outline:none; font-family:inherit;
    }}
    #_ai_textarea:focus {{ border-color:#2563eb; }}
    #_ai_send {{
      background:#2563eb; color:#fff; border:none; border-radius:8px;
      padding:9px 14px; font-size:18px; cursor:pointer; line-height:1;
    }}
    #_ai_send:hover {{ background:#1d4ed8; }}
    #_ai_clear {{
      text-align:center; color:#444; font-size:11px; padding:4px 0 6px;
      cursor:pointer;
    }}
    #_ai_clear:hover {{ color:#888; }}
    #_ai_thinking {{
      color:#555; font-size:12px; font-style:italic;
      padding:6px 14px; display:none;
    }}
  `;
  par.head.appendChild(style);

  // ── Build messages HTML ───────────────────────────────────────────────────
  var msgs = {msgs_js_array};
  var msgsHtml = '';
  if (msgs.length === 0) {{
    msgsHtml = '<div class="ai-msg-hint">Ask me anything about your sales data...</div>';
  }} else {{
    msgs.forEach(function(m) {{
      msgsHtml += '<div class="' + (m.role==='user'?'ai-msg-u':'ai-msg-a') + '">' +
        m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>';
    }});
  }}

  // ── Build quick prompts HTML ──────────────────────────────────────────────
  var quickPrompts = {quick_prompts_js};
  var quickHtml = quickPrompts.map(function(q) {{
    return '<button class="ai-qbtn" onclick="window._aiSend(\\''+q.replace(/'/g,"\\\\'")+'\\')">'+q+'</button>';
  }}).join('');

  // ── Create bubble ─────────────────────────────────────────────────────────
  var bubble = par.createElement('div');
  bubble.id = '_ai_bubble';
  bubble.innerHTML = '💬';
  bubble.title = 'AI Assistant';
  par.body.appendChild(bubble);

  // ── Create panel ──────────────────────────────────────────────────────────
  var panel = par.createElement('div');
  panel.id = '_ai_panel';
  panel.innerHTML = `
    <div id="_ai_hdr">
      <span>🤖 AI Assistant</span>
      <span id="_ai_close">✕</span>
    </div>
    <div id="_ai_msgs">` + msgsHtml + `</div>
    <div id="_ai_thinking">Thinking...</div>
    <div id="_ai_quick">` + quickHtml + `</div>
    <div id="_ai_inp_area">
      <textarea id="_ai_textarea" rows="1" placeholder="Ask about revenue, partners, competitors..."></textarea>
      <button id="_ai_send" title="Send">➤</button>
    </div>
    <div id="_ai_clear">Clear conversation</div>
  `;
  par.body.appendChild(panel);

  // ── Auto scroll messages ──────────────────────────────────────────────────
  var msgDiv = par.getElementById('_ai_msgs');
  if (msgDiv) msgDiv.scrollTop = 9999;

  // ── Toggle panel ──────────────────────────────────────────────────────────
  function togglePanel() {{
    panel.classList.toggle('open');
    if(panel.classList.contains('open')) {{
      par.getElementById('_ai_textarea').focus();
      msgDiv.scrollTop = 9999;
    }}
  }}
  bubble.addEventListener('click', togglePanel);
  par.getElementById('_ai_close').addEventListener('click', togglePanel);

  // ── Send message via hidden Streamlit form ────────────────────────────────
  window._aiSend = function(textOverride) {{
    var ta = par.getElementById('_ai_textarea');
    var val = (textOverride || ta.value || '').trim();
    if (!val) return;

    // Show user message immediately
    var msgDiv = par.getElementById('_ai_msgs');
    var newMsg = par.createElement('div');
    newMsg.className = 'ai-msg-u';
    newMsg.textContent = val;
    msgDiv.appendChild(newMsg);
    msgDiv.scrollTop = 9999;
    ta.value = '';
    par.getElementById('_ai_thinking').style.display = 'block';

    // Find Streamlit's hidden text input by aria-label
    var stInputs = par.querySelectorAll('input[type="text"]');
    var stInput = null;
    stInputs.forEach(function(inp) {{
      if (inp.getAttribute('aria-label') === '_msg' || inp.placeholder === '' && inp.id && inp.id.indexOf('chat') > -1) {{
        stInput = inp;
      }}
    }});

    // Fallback: find by data-testid pattern
    if (!stInput) {{
      stInputs.forEach(function(inp) {{
        if (inp.closest('[data-testid="stTextInput"]') && !stInput) {{
          stInput = inp;
        }}
      }});
    }}

    if (stInput) {{
      var nativeSetter = Object.getOwnPropertyDescriptor(window.parent.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(stInput, val);
      stInput.dispatchEvent(new Event('input', {{bubbles: true}}));

      // Click the submit button
      setTimeout(function() {{
        var btns = par.querySelectorAll('button');
        var submitBtn = null;
        btns.forEach(function(b) {{
          if (b.textContent.trim() === '_send' || b.getAttribute('data-testid') === 'baseButton-secondaryFormSubmit') {{
            submitBtn = b;
          }}
        }});
        if (!submitBtn) {{
          // Try by kind attribute
          btns.forEach(function(b) {{
            if (b.getAttribute('kind') === 'secondaryFormSubmit' && !submitBtn) submitBtn = b;
          }});
        }}
        if (submitBtn) submitBtn.click();
      }}, 80);
    }} else {{
      par.getElementById('_ai_thinking').style.display = 'none';
    }}
  }};

  // ── Textarea send on Enter ────────────────────────────────────────────────
  par.getElementById('_ai_textarea').addEventListener('keydown', function(e) {{
    if (e.key === 'Enter' && !e.shiftKey) {{ e.preventDefault(); window._aiSend(); }}
  }});
  par.getElementById('_ai_send').addEventListener('click', function() {{ window._aiSend(); }});

  // ── Clear conversation ────────────────────────────────────────────────────
  par.getElementById('_ai_clear').addEventListener('click', function() {{
    // Trigger clear by sending special token
    window._aiSend('__CLEAR__');
  }});

  // ── Keep panel open across rerenders ────────────────────────────────────
  if (window._chatWasOpen) panel.classList.add('open');
  bubble.addEventListener('click', function() {{
    window._chatWasOpen = panel.classList.contains('open');
  }});

}})();
</script>
""", height=0, scrolling=False)

# Handle clear command
if st.session_state.chat_history and (
    len(st.session_state.chat_history) > 0 and
    st.session_state.chat_history[-1].get("content") == "__CLEAR__"
):
    st.session_state.chat_history = []
    st.rerun()

# Hide the form from the main UI
st.markdown("""
<style>
[data-testid="stForm"] { position:absolute; left:-9999px; opacity:0; pointer-events:none; }
</style>
""", unsafe_allow_html=True)


# --- ROUTING LOGIC ---
if nav == "Partner 360 View":
    partner_360.render(ai)
elif nav == "Product Bundles (MBA)":
    market_basket.render(ai)
elif nav == "Inventory Liquidation":
    inventory.render(ai)
elif nav == "Cluster Intelligence":
    clustering.render(ai)
elif nav == "Product Lifecycle":
    product_lifecycle.render(ai)
elif nav == "Recommendation Hub":
    recommendation_hub.render(ai)
elif nav == "Competitor Intelligence":
    competitor_intel.render(ai)
elif nav == "Model Monitoring":
    monitoring.render(ai)
elif nav == "Sales Rep Performance":
    sales_rep_performance.render(ai)
