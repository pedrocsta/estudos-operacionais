import React from "react";

const Input = React.forwardRef(({ label, error, ...props }, ref) => {
  const { placeholder, ...rest } = props;

  return (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} className="input" {...rest} />
      {error && <div className="error">{error}</div>}
    </div>
  );
});
Input.displayName = "Input";

export default Input;
