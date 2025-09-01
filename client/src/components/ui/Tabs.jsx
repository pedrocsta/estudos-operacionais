import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export function Tabs({ value, onChange, items }){
  const wrapRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const reposition = () => {
    const el = tabRefs.current[value];
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ left: elRect.left - wrapRect.left, width: elRect.width });
  };

  useLayoutEffect(reposition, [value, items.length]);
  useEffect(() => {
    // garante cálculo depois que os refs foram ligados
    const id = requestAnimationFrame(reposition);
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <div className="tabs" role="tablist" aria-label="Tabs" ref={wrapRef}>
      <div
        className="tab-indicator"
        style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }}
      />
      {items.map(it => (
        <div
          key={it.value}
          role="tab"
          tabIndex={0}
          className={`tab ${value===it.value ? "active": ""}`}
          ref={(node) => { if (node) tabRefs.current[it.value] = node; }}
          onClick={() => onChange(it.value)}
          onKeyDown={(e)=> (e.key==="Enter"||e.key===" ") && onChange(it.value)}
          aria-selected={value===it.value}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
