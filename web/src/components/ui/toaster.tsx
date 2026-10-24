import { Slide, ToastContainer } from "react-toastify";

export function Toaster() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      pauseOnHover
      pauseOnFocusLoss
      closeOnClick={false}
      draggable={false}
      newestOnTop
      hideProgressBar={false}
      closeButton={false}
      icon={false}
      theme="light"
      transition={Slide}
      className="temis-toast-stack"
      toastClassName="temis-toast"
    />
  );
}
