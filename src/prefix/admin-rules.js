const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

const ADMIN_ROLE_ID = "1528735714878164992";
const RULES_COLOR = 0x5865f2;

function canViewAdminRules(interaction) {
  return (
    interaction.user.id === interaction.client.appEnv?.ownerId ||
    interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID) === true ||
    interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) === true
  );
}

function buildEnglishRulesEmbed(guild) {
  return new EmbedBuilder()
    .setAuthor({
      name: "Pixy Administration",
      iconURL: guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTitle("📌 Admin Team Rules & Guidelines")
    .setColor(RULES_COLOR)
    .setDescription(
      "Welcome to the Admin Team. Please read these rules fully before handling tickets or using bot management tools. Being an admin means helping users, protecting their information, and keeping the server organized—not simply having permissions."
    )
    .addFields(
      {
        name: "🎫 Handling Tickets",
        value:
          "• Check open tickets regularly and do not leave users waiting for an unreasonable time.\n" +
          "• If you cannot solve an issue immediately, tell the user that it is being reviewed or ask another admin for help.\n" +
          "• Stay respectful and calm, even when a user is frustrated or has configured something incorrectly.\n" +
          "• Do not close a ticket until the issue is resolved or the user no longer needs help.\n" +
          "• Add other users only when their involvement is necessary.\n" +
          "• Never share ticket content or user information outside the appropriate private admin channels.",
        inline: false,
      },
      {
        name: "🚨 Using Escalation",
        value:
          "Escalate only when a ticket genuinely needs additional authority or experience, such as a complex issue, security or privacy concern, widespread outage, or a decision from senior administration.\n\n" +
          "Do not escalate because you are busy, before basic troubleshooting, or for every minor issue. Read the full ticket, check setup and permissions, try appropriate fixes, and provide a clear reason describing what happened and what was attempted.",
        inline: false,
      },
      {
        name: "🐛 Reporting Bugs",
        value:
          "Use the Bug Report system only for a genuine code defect or unexpected bot behavior—for example, a working configuration where a command fails, the bot errors or crashes, data is handled incorrectly, or a feature repeatedly behaves differently from its intended behavior.\n\n" +
          "Missing permissions, incorrect IDs, incomplete setup, user misunderstanding, or an external Discord/Groq outage are usually not code bugs. Confirm the issue is reproducible, check configuration, include clear steps, actual and expected results, and relevant errors or IDs. Never include secrets.",
        inline: false,
      },
      {
        name: "🔐 Permissions & Security",
        value:
          "• Never use admin permissions for jokes, experiments, or actions that negatively affect users.\n" +
          "• Never share tokens, API keys, passwords, database URLs, or encryption keys.\n" +
          "• Do not delete data or change sensitive settings without clear authorization.\n" +
          "• Do not grant administrative access to unauthorized users.\n" +
          "• Document sensitive or unusual actions in the appropriate admin channel.\n" +
          "• Do not run destructive database or deployment commands unless you understand the result and have permission.",
        inline: false,
      },
      {
        name: "💬 Admin Communication",
        value:
          "• Use `#admins-chat` for internal discussion and `#bugs` for confirmed code issues.\n" +
          "• Notify the team before major changes.\n" +
          "• Ask before acting when uncertain.\n" +
          "• Include enough detail for another admin to continue the case.\n" +
          "• Do not argue with users publicly; move sensitive discussions to the correct private channel.",
        inline: false,
      },
      {
        name: "✅ Expected From Every Admin",
        value:
          "Monitor tickets, respond respectfully within a reasonable time, distinguish code bugs from setup problems, avoid unnecessary escalation, protect user information and project secrets, document important issues and solutions, and ask for help when unsure.\n\n" +
          "Repeated ticket neglect, permission abuse, private-data leaks, or intentional rule violations may result in removal from the Admin Team.",
        inline: false,
      }
    )
    .setFooter({ text: "After reading and understanding these rules, react to this message with ✅" })
    .setTimestamp();
}

function buildArabicRulesEmbed(guild) {
  return new EmbedBuilder()
    .setAuthor({
      name: "إدارة Pixy",
      iconURL: guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTitle("📌 قوانين وتعليمات فريق الإدارة")
    .setColor(RULES_COLOR)
    .setDescription(
      "أهلًا بك في فريق الإدارة. اقرأ القوانين كاملة قبل التعامل مع التكتات أو استخدام أدوات إدارة البوت. دور الإداري هو مساعدة المستخدمين، حماية معلوماتهم، والحفاظ على تنظيم السيرفر؛ وليس مجرد امتلاك صلاحيات."
    )
    .addFields(
      {
        name: "🎫 التعامل مع التكتات",
        value:
          "• راجع التكتات المفتوحة باستمرار ولا تترك المستخدم ينتظر وقتًا غير منطقي.\n" +
          "• لو لم تستطع حل المشكلة فورًا، أخبر المستخدم أنك تراجعها أو اطلب مساعدة إداري آخر.\n" +
          "• تعامل باحترام وهدوء حتى لو كان المستخدم منزعجًا أو إعداداته غير صحيحة.\n" +
          "• لا تغلق التكت قبل حل المشكلة أو تأكيد المستخدم أنه لا يحتاج مساعدة إضافية.\n" +
          "• لا تضف أشخاصًا إلا عند الحاجة الفعلية.\n" +
          "• لا تشارك محتوى التكت أو معلومات المستخدم خارج قنوات الإدارة الخاصة المناسبة.",
        inline: false,
      },
      {
        name: "🚨 استخدام التصعيد",
        value:
          "استخدم التصعيد فقط عندما تحتاج المشكلة فعلًا إلى خبرة أو صلاحية أعلى، مثل مشكلة معقدة، مشكلة أمن أو خصوصية، عطل يؤثر على عدد كبير من المستخدمين، أو قرار من الإدارة العليا.\n\n" +
          "لا تصعّد لمجرد أنك مشغول، ولا قبل تجربة الحلول الأساسية، ولا مع كل مشكلة صغيرة. اقرأ التكت كاملًا، راجع الإعدادات والصلاحيات، جرّب الحلول المناسبة، واكتب سببًا واضحًا يشرح ما حدث وما تم تجربته.",
        inline: false,
      },
      {
        name: "🐛 الإبلاغ عن الأخطاء",
        value:
          "استخدم نظام Bug Report فقط عند وجود خطأ حقيقي في الكود أو سلوك غير متوقع من البوت، مثل فشل أمر رغم صحة الإعدادات، ظهور Error أو توقف البوت، معالجة البيانات بشكل خاطئ، أو تكرار سلوك مختلف عن المفروض.\n\n" +
          "نقص الصلاحيات، IDs خاطئة، إعدادات ناقصة، سوء فهم المستخدم، أو عطل خارجي من Discord أو Groq ليست غالبًا أخطاء كود. تأكد أن المشكلة قابلة للتكرار، راجع الإعدادات، واكتب خطوات واضحة والنتيجة الحالية والمتوقعة وأي Errors أو IDs مهمة. لا ترسل أي أسرار.",
        inline: false,
      },
      {
        name: "🔐 الصلاحيات والأمان",
        value:
          "• لا تستخدم صلاحيات الإدارة للمزاح أو التجارب التي تؤثر على المستخدمين.\n" +
          "• لا تشارك Tokens أو API Keys أو كلمات المرور أو Database URLs أو Encryption Keys.\n" +
          "• لا تحذف بيانات أو تغيّر إعدادات حساسة بدون تصريح واضح.\n" +
          "• لا تمنح صلاحيات إدارية لأشخاص غير مصرح لهم.\n" +
          "• وثّق أي إجراء حساس أو غير معتاد في قناة الإدارة المناسبة.\n" +
          "• لا تشغّل أوامر قاعدة بيانات أو Deploy مدمرة إلا بعد فهم النتيجة والحصول على الإذن.",
        inline: false,
      },
      {
        name: "💬 التواصل بين الإداريين",
        value:
          "• استخدم `#admins-chat` للنقاشات الداخلية و`#bugs` للأخطاء البرمجية المؤكدة.\n" +
          "• أبلغ الفريق قبل أي تغيير كبير.\n" +
          "• اسأل قبل التنفيذ عندما تكون غير متأكد.\n" +
          "• اكتب تفاصيل كافية ليتمكن إداري آخر من متابعة الحالة.\n" +
          "• لا تجادل المستخدم علنًا؛ انقل النقاشات الحساسة إلى القناة الخاصة المناسبة.",
        inline: false,
      },
      {
        name: "✅ المطلوب من كل إداري",
        value:
          "تابع التكتات، رد باحترام وفي وقت مناسب، فرّق بين أخطاء الكود ومشاكل الإعدادات، تجنب التصعيد غير الضروري، احمِ معلومات المستخدمين وأسرار المشروع، وثّق المشاكل والحلول المهمة، واطلب المساعدة عندما لا تكون متأكدًا.\n\n" +
          "تجاهل التكتات بشكل متكرر، إساءة استخدام الصلاحيات، تسريب المعلومات الخاصة، أو مخالفة القوانين عمدًا قد يؤدي إلى إزالة صلاحيات الإدارة.",
        inline: false,
      }
    )
    .setFooter({ text: "بعد قراءة القوانين وفهمها، ضع تفاعل ✅ على الرسالة الأساسية" })
    .setTimestamp();
}

module.exports = {
  name: "admin-rules",
  aliases: ["adminrules", "staff-rules"],
  guildOnly: true,
  guildOnlyMessage: "This command can only be used inside a server.",

  async execute(message) {
    await message.delete().catch(() => null);

    const languageButton = new ButtonBuilder()
      .setCustomId("admin_rules_arabic")
      .setLabel("العربية")
      .setEmoji("🌐")
      .setStyle(ButtonStyle.Secondary);

    await message.channel.send({
      embeds: [buildEnglishRulesEmbed(message.guild)],
      components: [new ActionRowBuilder().addComponents(languageButton)],
      allowedMentions: { parse: [] },
    });
  },

  buttonHandlers: [
    {
      customId: "admin_rules_arabic",
      async execute(interaction) {
        if (!canViewAdminRules(interaction)) {
          return interaction.reply({
            content: "Only the bot owner, Admin role, or a server administrator can view these rules.",
            flags: 64,
          });
        }

        await interaction.reply({
          embeds: [buildArabicRulesEmbed(interaction.guild)],
          flags: 64,
          allowedMentions: { parse: [] },
        });
      },
    },
  ],
};
