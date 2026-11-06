export const HELP = {
  en: {
    title: "How to use",
    sections: [
      ["Before you start (organiser only)", [
        "Sign in with the organiser email and password. Only this phone needs to run the app.",
        "<b>Who's here today</b> — tap names to tick who came. Everyone from last session is pre-ticked.",
        "<b>New player</b> — type their name and pick a starting tier (<b>A</b> strongest, then B, C). You only do this once; after that their rating updates itself.",
        "<b>Courts</b> — how many courts you booked. Then tap <b>Start play day</b>."
      ]],
      ["Playing a game", [
        "Each court shows two teams either side of the dashed net. When the game ends, type each team's final score in the box under it (games go to 21; at 20-all a team needs a 2-point lead, up to 30). The team ahead turns green, so swapped scores are easy to spot. Tap <b>Finish</b>, check the result in words, then tap <b>Confirm</b>.",
        "New matches are unranked by default. Use the ranked toggle to make future matches ranked; matches already on court keep their mode.",
        "Ranked results update ratings. Unranked results record the score without changing ratings. Typed the wrong score? Tap <b>✎ Wrong score? Edit</b> in the pop-up. This works until one of those four players finishes another game.",
        "If other courts are still playing, the finished court shows <b>⏳ Holding</b> for up to 10 minutes, waiting until every court has finished. Then all courts are filled together from the full pool, so games stay fresh and fair. <b>▶ Fill now</b> skips the wait.",
        "<b>↻ Remix</b> redraws one court's game (only before it starts). <b>↻ All</b> redraws every court."
      ]],
      ["Taking a break or asking to play", [
        "Tap a name chip to cycle through three states:",
        "<b>plain</b> — normal, in the rotation.",
        "<b>⚡ keen</b> — wants to play next; gets priority for the next free spot.",
        "<b>☕ break</b> — resting; won't be picked until tapped back to normal.",
        "<b>💃</b> next to a name means that person has played 2+ games in a row."
      ]],
      ["Win streaks", [
        "Win 3 or more games in a row and a badge appears next to your name: <b>⭐</b> 3 wins, <b>🔥</b> 4 wins, <b>👑</b> 5+ wins.",
        "Everyone on a streak is listed in the <b>On a streak</b> banner at the top until they lose a game."
      ]],
      ["Ratings and tiers", [
        "Everyone has an Elo rating. Only ranked results change it: winners gain points and losers lose them. Both players on a team get the same change.",
        "The score matters: a bigger win moves ratings more. Winning 21–19 is a small change, 21–5 a big one (up to about 2.5× the closest win). The winner always gains, even after a close game. Labels: <b>Close game</b> (won by 4 or less), <b>Solid win</b> (5–10), <b>Dominant win</b> (11+).",
        "Teams are balanced on the exact ratings, and the app avoids repeating partners and matchups (today and recent sessions).",
        "Tiers are labels from the rating: <b>S</b> (earned only), <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b> (earned only, organiser-only label). A small buffer stops people flickering between tiers.",
        "New players' ratings move faster for their first 10 games, so a wrong starting tier corrects itself quickly."
      ]],
      ["Adjusting on the fly", [
        "<b>+ Court</b> adds a court mid-session. <b>✕ End</b> removes one — straight away if empty, or after its current game.",
        "<b>Players</b> panel: add someone who arrives late (existing or new), or remove someone leaving early. Removing a player mid-game flags them to leave once that game ends."
      ]],
      ["Good to know", [
        "Everything is saved as you go. Refreshing, closing the app or a flat battery is fine — sign in again and the session continues.",
        "Tap <b>End play day</b> when you finish. Ratings are kept for next time.",
        "Add the link to your home screen so it opens like a normal app."
      ]]
    ]
  },
  vi: {
    title: "Hướng dẫn sử dụng",
    sections: [
      ["Trước khi bắt đầu (người tổ chức)", [
        "Đăng nhập bằng email và mật khẩu của người tổ chức. Chỉ cần một điện thoại chạy app.",
        "<b>Who's here today</b> — bấm vào tên để đánh dấu ai có mặt. Những người đến buổi trước đã được đánh dấu sẵn.",
        "<b>Người chơi mới</b> — nhập tên và chọn tier ban đầu (<b>A</b> mạnh nhất, rồi B, C). Chỉ làm một lần; sau đó điểm sẽ tự cập nhật.",
        "<b>Courts</b> — số sân đã đặt. Sau đó bấm <b>Start play day</b>."
      ]],
      ["Khi chơi", [
        "Mỗi sân hiển thị hai đội ở hai bên lưới. Khi trận kết thúc, nhập điểm cuối của mỗi đội vào ô bên dưới đội đó (trận đến 21 điểm; nếu hoà 20-20 thì phải hơn 2 điểm, tối đa 30). Đội đang hơn điểm sẽ chuyển màu xanh để dễ thấy nếu nhập ngược. Bấm <b>Finish</b>, kiểm tra kết quả, rồi bấm <b>Confirm</b>.",
        "Trận mới mặc định không tính điểm. Bật nút Ranked để các trận tạo sau đó được tính điểm; trận đang trên sân giữ nguyên chế độ.",
        "Trận Ranked cập nhật điểm. Trận Unranked chỉ lưu tỉ số, không đổi điểm. Nhập sai tỉ số? Bấm <b>✎ Wrong score? Edit</b> trong thông báo. Chỉ sửa được khi chưa ai trong bốn người đó đánh xong trận khác.",
        "Nếu các sân khác vẫn đang chơi, sân vừa xong sẽ hiện <b>⏳ Holding</b> tối đa 10 phút, đợi cho tới khi tất cả các sân đều xong. Khi đó mọi sân được xếp trận cùng lúc từ toàn bộ người chơi, để trận mới và công bằng hơn. <b>▶ Fill now</b> để xếp ngay.",
        "<b>↻ Remix</b> xếp lại trận của một sân (chỉ trước khi bắt đầu đánh). <b>↻ All</b> xếp lại tất cả các sân."
      ]],
      ["Nghỉ hoặc xin được chơi", [
        "Bấm vào tên để đổi giữa ba trạng thái:",
        "<b>bình thường</b> — vẫn trong vòng xoay.",
        "<b>⚡ keen</b> — muốn chơi tiếp; được ưu tiên vào trận kế.",
        "<b>☕ break</b> — đang nghỉ; không bị xếp trận cho tới khi bấm về bình thường.",
        "<b>💃</b> cạnh tên nghĩa là người đó đã chơi 2 trận liên tiếp trở lên."
      ]],
      ["Chuỗi thắng", [
        "Thắng 3 trận liên tiếp trở lên sẽ có huy hiệu cạnh tên: <b>⭐</b> 3 trận, <b>🔥</b> 4 trận, <b>👑</b> 5 trận trở lên.",
        "Những người đang có chuỗi thắng hiện ở khung <b>On a streak</b> phía trên cho tới khi thua một trận."
      ]],
      ["Điểm Elo và tier", [
        "Mỗi người có điểm Elo. Chỉ trận Ranked mới đổi điểm: thắng được cộng, thua bị trừ. Hai người cùng đội nhận cùng mức thay đổi.",
        "Tỉ số cũng quan trọng: thắng càng đậm thì điểm thay đổi càng nhiều. Thắng 21–19 thay đổi ít, thắng 21–5 thay đổi nhiều (tối đa khoảng 2,5 lần so với trận thắng sát nhất). Đội thắng luôn được cộng điểm, kể cả khi thắng sát. Nhãn: <b>Close game</b> (thắng cách 4 điểm trở xuống), <b>Solid win</b> (5–10), <b>Dominant win</b> (11 trở lên).",
        "Các đội được cân theo điểm chính xác, và app tránh lặp lại cặp đôi hoặc cặp đấu (hôm nay và vài buổi gần đây).",
        "Tier là nhãn dựa trên điểm: <b>S</b> (chỉ đạt được qua thi đấu), <b>A</b>, <b>B</b>, <b>C</b>, <b>D</b> (chỉ đạt được qua thi đấu, chỉ người tổ chức thấy). Có một vùng đệm nhỏ để tier không nhảy qua lại liên tục.",
        "Người mới thay đổi điểm nhanh hơn trong 10 trận đầu, nên nếu chọn tier ban đầu sai thì sẽ tự điều chỉnh nhanh."
      ]],
      ["Điều chỉnh giữa buổi", [
        "<b>+ Court</b> thêm sân giữa buổi. <b>✕ End</b> xoá sân — xoá ngay nếu sân trống, hoặc sau khi trận hiện tại xong.",
        "Bảng <b>Players</b>: thêm người đến muộn (đã có hoặc mới), hoặc xoá người về sớm. Xoá người đang thi đấu chỉ đánh dấu để họ rời sau khi trận đó kết thúc."
      ]],
      ["Lưu ý", [
        "Mọi thứ được lưu ngay. Refresh, tắt app hay hết pin đều không sao — đăng nhập lại là tiếp tục buổi chơi.",
        "Bấm <b>End play day</b> khi kết thúc. Điểm được giữ cho lần sau.",
        "Thêm link vào màn hình chính để mở như một app bình thường."
      ]]
    ]
  }
};

