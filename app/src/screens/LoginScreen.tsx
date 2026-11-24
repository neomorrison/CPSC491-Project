import { AuthForm } from './SignUpScreen'; 

export default function LoginScreen ({
    onSignUp,
}: {
    onSignUp: () => void;
}) {
    return <AuthForm mode="login" onSwitch={onSignUp} />; 
}