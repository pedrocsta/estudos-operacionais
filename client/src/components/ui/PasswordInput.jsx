import React, { useState } from "react";
import EyeIcon from "../../assets/icons/eye.svg";
import EyeOffIcon from "../../assets/icons/eye-off.svg";

const PasswordInput = React.forwardRef(({ label, error, ...props }, ref) => {
  const [show, setShow] = useState(false);
  const { placeholder, ...rest } = props; // ignora placeholder

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="input-box has-eye">
        <input
          ref={ref}
          className="input"
          type={show ? "text" : "password"}
          {...rest}
        />
        <button
          type="button"
          className="eye"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          title={show ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setShow(v => !v)}
        >
          <img src={show ? EyeOffIcon : EyeIcon} alt="" aria-hidden="true" />
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
