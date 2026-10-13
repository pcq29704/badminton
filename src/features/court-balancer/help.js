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
        "Each court shows two teams either side of the dashed net. When the game ends, tap <b>🏆 Won</b> under the winning side.",
        "New matches are unranked by default. Use the ranked toggle to make future matches ranked; matches already on court keep their mode.",
        "Ranked results show everyone's rating change. Unranked results record the winner without changing ratings. Tap <b>⇄ Flip result</b> in the pop-up or Log if you tapped the wrong side.",
        "If other courts are still playing, the finished court shows <b>⏳ Holding</b> for up to 10 minutes, waiting for another court so there's a bigger pool to draw a fresh, fair game from. <b>▶ Fill now</b> skips the wait.",
        "<b>↻ Remix</b> redraws one court's game (only before it starts). <b>↻ All</b> redraws every court."
      ]],
      ["Taking a break or asking to play", [
        "Tap a name chip to cycle through three states:",
        "<b>plain</b> — normal, in the rotation.",
        "<b>⚡ keen</b> — wants to play next; gets priority for the next free spot.",
        "<b>☕ break</b> — resting; won't be picked until tapped back to normal.",
        "<b>🔥</b> next to a name means that person has played 2+ games in a row."
      ]],
      ["Ratings and tiers", [
        "Everyone has an Elo rating. Only ranked results change it: winners gain points and losers lose them. Both players on a team get the same change.",
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
        "Mỗi sân hiển thị hai đội ở hai bên lưới. Khi trận kết thúc, bấm <b>🏆 Won</b> ở dưới đội thắng.",
        "Trận mới mặc định không tính điểm. Bật nút Ranked để các trận tạo sau đó được tính điểm; trận đang trên sân giữ nguyên chế độ.",
        "Trận Ranked hiện thay đổi điểm của từng người. Trận Unranked chỉ lưu đội thắng, không đổi điểm. Bấm <b>⇄ Flip result</b> để sửa đội thắng.",
        "Nếu các sân khác vẫn đang chơi, sân vừa xong sẽ hiện <b>⏳ Holding</b> tối đa 10 phút, đợi thêm một sân xong để có nhiều người hơn, xếp trận mới và công bằng hơn. <b>▶ Fill now</b> để xếp ngay.",
        "<b>↻ Remix</b> xếp lại trận của một sân (chỉ trước khi bắt đầu đánh). <b>↻ All</b> xếp lại tất cả các sân."
      ]],
      ["Nghỉ hoặc xin được chơi", [
        "Bấm vào tên để đổi giữa ba trạng thái:",
        "<b>bình thường</b> — vẫn trong vòng xoay.",
        "<b>⚡ keen</b> — muốn chơi tiếp; được ưu tiên vào trận kế.",
        "<b>☕ break</b> — đang nghỉ; không bị xếp trận cho tới khi bấm về bình thường.",
        "<b>🔥</b> cạnh tên nghĩa là người đó đã chơi 2 trận liên tiếp trở lên."
      ]],
      ["Điểm Elo và tier", [
        "Mỗi người có điểm Elo. Chỉ trận Ranked mới đổi điểm: thắng được cộng, thua bị trừ. Hai người cùng đội nhận cùng mức thay đổi.",
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

