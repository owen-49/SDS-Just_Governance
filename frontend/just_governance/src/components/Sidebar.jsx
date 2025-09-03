import React, { useMemo, useState } from 'react';
import { sections } from '../data/structure';

export default function Sidebar({ ui, onToggleCollapsed, onToggleSection, onToggleModule, onSelectTopic, currentTopicId, user }) {
  const collapsed = ui?.collapsed;
  // 新增：主题搜索
  const [query, setQuery] = useState('');
  const renderSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    // 过滤：仅保留名称匹配的 section/module/topic；无匹配则剔除
    return sections
      .map(sec => {
        const matchedModules = (sec.modules || []).map(mod => {
          const matchedTopics = (mod.topics || []).filter(tp => tp.name.toLowerCase().includes(q));
          if (matchedTopics.length > 0 || mod.name.toLowerCase().includes(q)) {
            return { ...mod, topics: matchedTopics.length > 0 ? matchedTopics : mod.topics };
          }
          return null;
        }).filter(Boolean);
        if (matchedModules.length > 0 || sec.name.toLowerCase().includes(q)) {
          return { ...sec, modules: matchedModules.length > 0 ? matchedModules : sec.modules };
        }
        return null;
      })
      .filter(Boolean);
  }, [query]);

  return (
    <aside style={{
      width: collapsed ? 56 : 280,
      background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)', color: '#e2e8f0', height: 'calc(100vh - 56px)',
      transition: 'width .2s ease', position: 'sticky', top: 56, overflowY: 'auto', borderRight: '1px solid #0b1220'
    }}>
      <div style={{ padding: 12, display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center' }}>
        {!collapsed && <div style={{ fontWeight: 700, letterSpacing: .3 }}>Navigation</div>}
        <button onClick={onToggleCollapsed} title={collapsed ? 'Expand' : 'Collapse'} style={{ background: 'transparent', color: '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: 16 }}>{collapsed ? '›' : '‹'}</button>
      </div>

      {/* 搜索框（展开时显示） */}
      {!collapsed && (
        <div style={{ padding: '0 12px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8, padding: '6px 10px'
          }}>
            <span aria-hidden>🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0' }}
            />
            {query && (
              <button onClick={() => setQuery('')} title="Clear" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div style={{ padding: 8 }}>
          {renderSections.map(sec => (
            <div key={sec.id}>
              {/* section 行 */}
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer', borderRadius: 8,
                         background: ui.expanded?.[sec.id] || query ? 'rgba(148,163,184,0.08)' : 'transparent' }}
                onClick={() => !query && onToggleSection(sec.id)}
                title={sec.name}
              >
                <span style={{ fontWeight: 600 }}>📚 {sec.name}</span>
                <span>{(ui.expanded?.[sec.id] || query) ? '▾' : '▸'}</span>
              </div>

              {(ui.expanded?.[sec.id] || query) && (
                <div style={{ paddingLeft: 12 }}>
                  {sec.modules.map(mod => (
                    <div key={mod.id}>
                      {/* module 行 */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer', opacity: 0.98, borderRadius: 8,
                                 background: ui.expanded?.[mod.id] || query ? 'rgba(148,163,184,0.06)' : 'transparent' }}
                        onClick={() => !query && onToggleModule(mod.id)}
                        title={mod.name}
                      >
                        <span>📦 {mod.name}</span>
                        <span>{(ui.expanded?.[mod.id] || query) ? '▾' : '▸'}</span>
                      </div>

                      {(ui.expanded?.[mod.id] || query) && (
                        <div style={{ paddingLeft: 12 }}>
                          {mod.topics.map(tp => {
                            const active = currentTopicId === tp.id;
                            return (
                              <div
                                key={tp.id}
                                onClick={() => onSelectTopic(sec, mod, tp)}
                                style={{
                                  padding: '8px 10px', cursor: 'pointer', borderRadius: 10,
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  background: active ? 'linear-gradient(90deg, #1d4ed8 0%, #0ea5e9 100%)' : 'transparent',
                                  color: active ? '#fff' : '#e2e8f0',
                                  border: active ? '1px solid rgba(14,165,233,0.6)' : '1px solid transparent',
                                  boxShadow: active ? '0 6px 18px rgba(2,132,199,0.25)' : 'none',
                                  transition: 'background .15s ease, color .15s ease, box-shadow .15s ease, border-color .15s ease',
                                  margin: '3px 0'
                                }}
                                title={tp.name}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  <span aria-hidden>{active ? '✅' : '📘'}</span>
                                  <span>{tp.name}</span>
                                </span>
                                <span style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.9)' : '#94a3b8' }}>Topic</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {renderSections.length === 0 && (
            <div style={{ color: '#94a3b8', padding: '8px 10px' }}>No results</div>
          )}
        </div>
      )}

      {!collapsed && (
        <div style={{ marginTop: 16, padding: 12, borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#334155,#1f2937)' }} />
            <div>
              <div style={{ fontWeight: 600 }}>{user?.name || user?.email}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>v0.1</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
