import SignUpScreen from './SignUpScreen';

export default function WelcomeScreen({
    onLogin, 
}: {
    onLogin: () => void; 
}) {
    return <SignUpScreen onLogin={onLogin} />;
}