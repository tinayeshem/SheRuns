import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

type FormData = {
  email: string;
  password: string;
};

export default function Login() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    console.log("Login attempt:", data); // real auth comes later
    navigate("/home");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-1">Safe Run</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Run where it feels safe.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2"
              {...register("email", { required: "Email is required" })}
            />
            {errors.email && (
              <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 6, message: "At least 6 characters" },
              })}
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white rounded-lg py-2 font-medium"
          >
            Log in
          </button>
        </form>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t" />
          <span className="px-3 text-xs text-gray-400">or</span>
          <div className="flex-1 border-t" />
        </div>

        <button
          type="button"
          className="w-full border rounded-lg py-2 mb-2"
          onClick={() => alert("Google login comes later")}
        >
          Continue with Google
        </button>

        <button
          type="button"
          className="w-full border rounded-lg py-2"
          onClick={() => navigate("/profile-setup")}
        >
          Continue as guest
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          No account? Sign up (coming soon)
        </p>
      </div>
    </div>
  );
}