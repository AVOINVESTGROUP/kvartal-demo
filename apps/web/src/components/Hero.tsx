export const Hero = () => {
  return (
    <section className="relative overflow-hidden text-white bg-[radial-gradient(circle_at_80%_10%,rgba(201,166,107,0.22),transparent_34%),linear-gradient(130deg,rgba(7,29,58,0.98),rgba(7,29,58,0.86)),linear-gradient(45deg,#0d2e58,#071d3a)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.8),transparent)] pointer-events-none"></div>
      
      <div className="relative max-w-kv-container mx-auto px-5 grid lg:grid-cols-[1fr,420px] gap-12 items-center py-20 lg:py-24">
        <div>
          <div className="flex items-center gap-2.5 mb-4.5 text-white/80 text-[13px] font-extrabold uppercase tracking-widest before:content-[''] before:w-[34px] before:h-[2px] before:bg-kv-gold">
            Elite Commercial Real Estate
          </div>
          <h1 className="text-4xl lg:text-7xl font-black leading-[0.98] tracking-[-0.045em] max-w-[780px]">
            Продажа и аренда особняков в Москве
          </h1>
          <p className="max-w-[670px] mt-6 text-xl text-white/78 leading-relaxed">
            Подбор уникальных объектов недвижимости в ЦАО для вашего бизнеса. Офф-маркет предложения и полное сопровождение.
          </p>
          
          <div className="flex flex-wrap gap-3.5 mt-8.5">
            <button className="bg-kv-red text-white px-8 py-4 rounded-full font-extrabold hover:bg-kv-red-dark transition-all hover:-translate-y-px shadow-xl cursor-pointer">
              Смотреть объекты
            </button>
            <button className="bg-white/10 border border-white/28 text-white px-8 py-4 rounded-full font-extrabold hover:bg-white/20 transition-all cursor-pointer">
              О компании
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10.5 max-w-[760px]">
            <div className="p-4.5 border border-white/12 rounded-2xl bg-white/6">
              <span className="block text-3xl font-black text-white">15+</span>
              <span className="block mt-1 text-white/68 text-[13px]">лет на рынке</span>
            </div>
            <div className="p-4.5 border border-white/12 rounded-2xl bg-white/6">
              <span className="block text-3xl font-black text-white">250+</span>
              <span className="block mt-1 text-white/68 text-[13px]">объектов в ЦАО</span>
            </div>
            <div className="p-4.5 border border-white/12 rounded-2xl bg-white/6">
              <span className="block text-3xl font-black text-white">48</span>
              <span className="block mt-1 text-white/68 text-[13px]">сделок в 2023</span>
            </div>
          </div>
        </div>

        <div className="p-7 border border-white/16 rounded-kv-main bg-white/10 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-2.5 leading-tight">Подобрать объект</h2>
          <p className="text-white/72 mb-5 text-[15px]">Оставьте заявку, и мы подготовим подборку под ваш запрос за 15 минут</p>
          
          <form className="grid gap-3">
            <input type="text" placeholder="Ваше имя" className="w-full p-3.5 rounded-kv-form bg-white text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18" />
            <input type="tel" placeholder="+7 (___) ___-__-__" className="w-full p-3.5 rounded-kv-form bg-white text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18" />
            <textarea placeholder="Опишите ваши требования (площадь, район, бюджет)" className="w-full p-3.5 rounded-kv-form bg-white text-kv-ink outline-none focus:ring-4 focus:ring-kv-gold/18 min-h-[96px] resize-none"></textarea>
            <button type="submit" className="bg-kv-red text-white py-4 rounded-full font-extrabold hover:bg-kv-red-dark transition-all mt-2 shadow-lg cursor-pointer">
              Получить подборку
            </button>
            <div className="flex gap-2.5 text-[12px] text-white/68 mt-2 items-start">
              <input type="checkbox" className="mt-1" defaultChecked />
              <span>Я согласен с политикой обработки персональных данных</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
