  function photo(kind) {
    const W = 300;
    const table = { tacos: "#8A5A3B", tacosSide: "#8A5A3B", bowl: "#D9D2C5", bowlSide: "#D9D2C5", pasta: "#3E4A5A", salad: "#C9B79C", latte: "#6B4B36", toast: "#E5DED2", dog: "#7FA06A", sunset: "#F2A65A" }[kind];
    let s = `<rect width="${W}" height="${W}" fill="${table}"/>`;
    const grain = (c) => { let g = ""; for (let i = 0; i < 9; i++) g += `<rect x="0" y="${i * 34 + 10}" width="${W}" height="2" fill="${c}" opacity=".18"/>`; return g; };
    if (kind === "tacos") {
      s += grain("#000") + `<circle cx="150" cy="150" r="125" fill="#F3F0EA"/><circle cx="150" cy="150" r="108" fill="#FAF8F4"/>`;
      [[105, 120, -20], [190, 135, 15], [150, 205, 0]].forEach(([x, y, r]) => {
        s += `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="52" ry="30" fill="#E8C98E"/><ellipse cx="${x}" cy="${y}" rx="40" ry="18" fill="#8C3B22"/><circle cx="${x - 14}" cy="${y - 4}" r="5" fill="#F4F1E6"/><circle cx="${x + 6}" cy="${y + 3}" r="5" fill="#F4F1E6"/><circle cx="${x + 18}" cy="${y - 5}" r="4" fill="#5DA34A"/><circle cx="${x - 2}" cy="${y - 8}" r="4" fill="#5DA34A"/></g>`;
      });
      s += `<circle cx="232" cy="225" r="18" fill="#8FC04A"/><circle cx="232" cy="225" r="12" fill="#C9E18C"/>`;
    } else if (kind === "tacosSide") {
      s = `<rect width="${W}" height="${W}" fill="#5B3B27"/><rect y="0" width="${W}" height="150" fill="#C9B9A5"/><ellipse cx="150" cy="215" rx="140" ry="42" fill="#F3F0EA"/>`;
      [70, 150, 230].forEach((x) => { s += `<path d="M${x - 46} 205 Q${x} 120 ${x + 46} 205 Z" fill="#E8C98E"/><path d="M${x - 36} 200 Q${x} 140 ${x + 36} 200 Z" fill="#8C3B22"/><circle cx="${x - 8}" cy="168" r="6" fill="#F4F1E6"/><circle cx="${x + 10}" cy="174" r="5" fill="#5DA34A"/>`; });
    } else if (kind === "bowl") {
      s += `<circle cx="150" cy="150" r="118" fill="#2F5F8A"/><circle cx="150" cy="150" r="102" fill="#EADBC0"/>`;
      for (let i = 0; i < 14; i++) { const a = i * 0.9, r = 30 + (i % 4) * 14; s += `<circle cx="${150 + Math.cos(a) * r}" cy="${150 + Math.sin(a) * r}" r="${7 + (i % 3)}" fill="${["#3B3B8F", "#C2263A", "#5A2B6E"][i % 3]}"/>`; }
      s += `<path d="M95 120 Q150 95 205 120" stroke="#E2A93B" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    } else if (kind === "bowlSide") {
      s = `<rect width="${W}" height="${W}" fill="#B8AE9E"/><rect y="0" width="${W}" height="140" fill="#EFE9DE"/><path d="M50 150 Q150 290 250 150 Z" fill="#2F5F8A"/><ellipse cx="150" cy="150" rx="100" ry="22" fill="#EADBC0"/><circle cx="125" cy="146" r="8" fill="#3B3B8F"/><circle cx="160" cy="150" r="8" fill="#C2263A"/><circle cx="185" cy="144" r="7" fill="#5A2B6E"/>`;
    } else if (kind === "pasta") {
      s += `<circle cx="150" cy="150" r="125" fill="#ECECEC"/><circle cx="150" cy="150" r="100" fill="#F7F7F5"/>`;
      for (let i = 0; i < 9; i++) s += `<path d="M${80 + i * 6} ${110 + (i % 3) * 18} q40 -30 70 10 t70 0" stroke="#EBC56B" stroke-width="9" fill="none" stroke-linecap="round"/>`;
      s += `<circle cx="150" cy="150" r="34" fill="#B5321F" opacity=".9"/><circle cx="140" cy="140" r="6" fill="#4C8B3A"/><circle cx="165" cy="155" r="5" fill="#4C8B3A"/><circle cx="135" cy="168" r="9" fill="#F2EBDD"/>`;
    } else if (kind === "salad") {
      s += grain("#fff") + `<circle cx="150" cy="150" r="120" fill="#FFFFFF"/>`;
      for (let i = 0; i < 18; i++) { const a = i * 1.3, r = 15 + (i % 5) * 16; s += `<ellipse cx="${150 + Math.cos(a) * r}" cy="${150 + Math.sin(a) * r}" rx="22" ry="12" transform="rotate(${i * 25} ${150 + Math.cos(a) * r} ${150 + Math.sin(a) * r})" fill="${["#5E9E3C", "#8BC34A", "#3E7B2C"][i % 3]}"/>`; }
      [[120, 120], [190, 160], [140, 195]].forEach(([x, y]) => { s += `<circle cx="${x}" cy="${y}" r="13" fill="#E0412F"/>`; });
      s += `<rect x="160" y="95" width="46" height="30" rx="6" fill="#F0D9A8"/><rect x="95" y="165" width="40" height="26" rx="6" fill="#F0D9A8"/>`;
    } else if (kind === "latte") {
      s += `<circle cx="150" cy="150" r="110" fill="#F2EEE8"/><circle cx="150" cy="150" r="78" fill="#FFFFFF"/><circle cx="150" cy="150" r="64" fill="#B07A4F"/><path d="M150 112 C120 130 125 165 150 185 C175 165 180 130 150 112 Z" fill="#F4E6D3"/><path d="M150 125 C135 140 138 160 150 172 C162 160 165 140 150 125 Z" fill="#B07A4F"/><rect x="235" y="138" width="40" height="24" rx="12" fill="#FFFFFF"/>`;
    } else if (kind === "toast") {
      s += `<rect x="40" y="55" width="220" height="190" rx="18" fill="#FFFFFF"/><rect x="65" y="80" width="100" height="110" rx="20" fill="#C98A45"/><rect x="73" y="88" width="84" height="94" rx="14" fill="#E8B872"/><circle cx="215" cy="150" r="34" fill="#FFFFFF" stroke="#EEE" stroke-width="3"/><circle cx="215" cy="150" r="15" fill="#F2B21B"/><circle cx="115" cy="135" r="20" fill="#6F9F3A" opacity=".85"/>`;
    } else if (kind === "dog") {
      s += `<circle cx="150" cy="170" r="80" fill="#C99A5B"/><circle cx="150" cy="140" r="58" fill="#D8AD70"/><ellipse cx="100" cy="115" rx="22" ry="40" fill="#8E6234"/><ellipse cx="200" cy="115" rx="22" ry="40" fill="#8E6234"/><circle cx="130" cy="135" r="7" fill="#222"/><circle cx="170" cy="135" r="7" fill="#222"/><ellipse cx="150" cy="160" rx="13" ry="9" fill="#222"/>`;
    } else if (kind === "sunset") {
      s += `<rect y="150" width="${W}" height="150" fill="#3D5A80"/><circle cx="150" cy="160" r="50" fill="#FFD27A"/><rect y="160" width="${W}" height="140" fill="#2D4466"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${100 + (i % 2) * 10}" y="${175 + i * 14}" width="${100 - i * 12}" height="4" fill="#FFD27A" opacity=".6"/>`;
    }
    return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}">${s}</svg>`);
  }

