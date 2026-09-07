interface AvatarProps {
  url?: string | null;
  name?: string;
  size?: number; // px
  className?: string;
}

export default function Avatar({ url, name, size = 36, className = '' }: AvatarProps) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'avatar'}
        style={style}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`rounded-full bg-blue-600 flex items-center justify-center font-bold text-white uppercase flex-shrink-0 ${className}`}
    >
      {name ? name.charAt(0) : 'U'}
    </div>
  );
}