import React from 'react';
import { sections } from '../data/structure';

export default function Sidebar({ ui, onToggleCollapsed, onToggleSection, onToggleModule, onSelectTopic, currentTopicId, user }) {
  const collapsed = ui?.collapsed;
  return (
    <aside style={{
      width: collapsed ? 56 : 280,
      background: '#0f172a', color: '#e2e8f0', height: 'calc(100vh - 56px)',
      transition: 'width .2s ease', position: 'sticky', top: 56, overflowY: 'auto'
    }}>
      <div style={{ padding: 12, display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center' }}>
        {!collapsed && <div style={{ fontWeight: 700 }}>Navigation</div>}
        <button onClick={onToggleCollapsed} style={{ background: 'transparent', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}>{collapsed ? '›' : '‹'}</button>
      </div>
      {!collapsed && (
        <div style={{ padding: 8 }}>
          {sections.map(sec => (
            <div key={sec.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer' }} onClick={() => onToggleSection(sec.id)}>
                <span style={{ fontWeight: 600 }}>{sec.name}</span>
                <span>{ui.expanded?.[sec.id] ? '▾' : '▸'}</span>
              </div>
              {ui.expanded?.[sec.id] && (
                <div style={{ paddingLeft: 12 }}>
                  {sec.modules.map(mod => (
                    <div key={mod.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', cursor: 'pointer', opacity: 0.95 }} onClick={() => onToggleModule(mod.id)}>
                        <span>{mod.name}</span>
                        <span>{ui.expanded?.[mod.id] ? '▾' : '▸'}</span>
                      </div>
                      {ui.expanded?.[mod.id] && (
                        <div style={{ paddingLeft: 12 }}>
                          {mod.topics.map(tp => (
                            <div key={tp.id} onClick={() => onSelectTopic(sec, mod, tp)} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 6, background: currentTopicId === tp.id ? '#1f2937' : 'transparent' }}>
                              {tp.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!collapsed && (
        <div style={{ marginTop: 16, padding: 12, borderTop: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#334155' }} />
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
