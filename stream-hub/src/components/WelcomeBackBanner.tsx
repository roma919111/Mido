type WelcomeBackBannerProps = {
  onDismiss: () => void;
};

export function WelcomeBackBanner({ onDismiss }: WelcomeBackBannerProps) {
  return (
    <div className="welcome-back-banner" role="status">
      <div className="welcome-back-banner__text">
        <strong>🏠 مرحباً بعودتك إلى MAX</strong>
        <p>اختر فيلماً أو مسلسلاً آخر — لا حاجة لتحميل Netflix أو شاهد</p>
      </div>
      <button type="button" className="welcome-back-banner__btn" onClick={onDismiss}>
        متابعة التصفح
      </button>
    </div>
  );
}
