import React from "react";

export default function Button({
  children,
  className = "",
  variant = "solid",   // "solid" | "outline"
  ...props
}) {
  const map = {
    solid: "btn btn-solid",
    outline: "btn btn-outline",
  };
  return (
    <button className={`${map[variant] ?? map.solid} ${className}`} {...props}>
      {children}
    </button>
  );
}
