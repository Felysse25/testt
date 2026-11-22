window.EXHIBITION = {
  // See HOW TO ADD MY CONTENT.md for media paths and examples.
  analytics: {measurementId: 'G-XXXXXXXXXX'},
  islands: [
    { id: 'main', name: 'Welcome & Research Center', short: 'Main island', color: '#d46b48', exhibits: ['welcome', 'research', 'interviews', 'vegetarian', 'map', 'feedback', 'quiz', 'reflection'] },
    { id: 'home_memories', name: 'Home & Memories', short: 'Home & Memories', color: '#bd593e', exhibits: ['ph', 'vn'] },
    { id: 'culture_identity', name: 'Culture & Identity', short: 'Culture & Identity', color: '#467b57', exhibits: ['my', 'id'] },
    { id: 'food_adaptation', name: 'Food & Adaptation', short: 'Food & Adaptation', color: '#5261a0', exhibits: ['th', 'tw'] }
  ],
  stations: {
    welcome: {
      title: 'Welcome', color: '#bd593e', video: '',
      text: 'MORE THAN A MEAL is a student-led Tzu Chi University research exhibition. It explores how food connects international students to home, culture, and memory as they build new experiences in Taiwan.'
    },
    research: {
      title: 'Research dashboard', color: '#387d80',
      metrics: [
        {value: '30', label: 'Survey responses'},
        {value: '6', label: 'Countries, with five respondents each'},
        {value: '3.97 / 5', label: 'Average emotional connection'},
        {value: '70%', label: 'Rated emotional connection 4 or 5'}
      ],
      additionalFindings: [],
      infographic: {path: '', alt: '' }
    },
    interviews: {
      title: 'Interview theater', color: '#625998',
      interviews: [
        {id: 'senior_vp', name: 'Senior Vice President of Tzu Chi University', video: ''},
        {id: 'student_interview', name: 'Myeisha Alvez', role: 'Sri Lankan student', video: 'assets/interviews/myeisha-alvez.mp4'}
      ]
    },
    vegetarian: {
      title: 'Vegetarian recommendations', color: '#467b57',
      text: 'We propose a rotating menu of internationally diverse vegetarian dishes at Tzu Chi University. Co-design and taste-test recipes with international students and campus dining staff. Label ingredients and collect feedback during a pilot.',
      ideas: [
        'Tamarind and vegetable sinigang with mushrooms and tofu',
        'Coconut rice with tempeh, cucumber, and vegetarian sambal',
        'Tom yum with mushrooms, herbs, and vegetable stock'
      ]
    },
    map: {title: 'Island map', color: '#97691d'},
    quiz: {title: 'Cultural Food Quiz', color: '#72558e'},
    reflection: {title: 'Reflection Wall', color: '#a45556'},
    feedback: {
      title: 'Share Your Experience', color: '#387d80',
      text: 'Thank you for exploring More Than a Meal! Your feedback helps us understand whether our exhibition encouraged cultural awareness and intercultural connection.',
      formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdGTiRTaI8-kBwknFhhZ3dXFzD2vfcdtRkLfuwkuuXWQUxgyA/viewform?usp=dialog'
    }
  },
  visitorActivities: {
    stamps: {ph: '🥣', vn: '🍜', my: '🥥', id: '🍳', th: '🍄', tw: '🥟'},
    quiz: [
      {
        prompt: 'What is the exhibition exploring?',
        options: ['How food connects international students to home, culture, and memory', 'How to rank the six cuisines', 'How to find the fastest recipes'],
        answer: 0,
        explanation: 'The exhibition explores these connections as students build new experiences in Taiwan.'
      },
      {
        prompt: 'Which ingredient commonly gives Sinigang its sour flavor?',
        options: ['Coconut milk', 'Tamarind', 'Soy sauce'],
        answer: 1,
        explanation: 'Tamarind is a common souring ingredient. Home cooks also use other souring ingredients.'
      },
      {
        prompt: 'Which dish centers on rice cooked in coconut milk?',
        options: ['Tom yum', 'Bánh canh', 'Nasi lemak'],
        answer: 2,
        explanation: 'Nasi lemak centers on coconut rice, often served with sambal, cucumber, peanuts, egg, and anchovies.'
      },
      {
        prompt: 'What does the exhibition say about recipes for Indonesian nasi goreng?',
        options: ['All recipes are identical', 'Recipes vary among regions, households, and street vendors', 'It is always served without toppings'],
        answer: 1,
        explanation: 'Nasi goreng varies across communities and kitchens. Egg, crackers, or cucumber may accompany it.'
      },
      {
        prompt: 'Which two dishes can you explore in the Taiwan zone?',
        options: ['Beef noodles and dumplings', 'Sinigang and Tom yum', 'Nasi lemak and nasi goreng'],
        answer: 0,
        explanation: 'The Taiwan zone includes Taiwanese beef noodle soup and dumplings.'
      }
    ]
  },
  countries: {
    ph: {
      name: 'Philippines', flag: 'exhibition/media/ph.png', color: '#bd593e',
      dishes: [{
        id: 'sinigang', name: 'Sinigang', model: '', video: '',
        intro: 'Sinigang is a Filipino soup known for its sour, savory broth. Tamarind is a common souring ingredient, and cooks often add vegetables such as okra, radish, or water spinach.',
        background: 'Home cooks prepare sinigang with different souring ingredients and combinations of fish, meat, and vegetables. It is often served with rice. For one survey respondent, cooking the dish in Taiwan brought back memories of home.',
        quote: "Cooking sinigang in Taiwan, especially during winter, brings back memories of my family's kitchen.",
        photos: [
          {path: 'exhibition/media/sinigang-bangus.jpg', alt: 'Sinigang prepared with bangus (milkfish)', credit: 'Sinigang bangus · Judgefloro, CC0', source: 'https://commons.wikimedia.org/wiki/File:1591aSinigang_bangus.jpg'},
          {path: 'exhibition/media/sinigang-isda.jpg', alt: 'A serving of fish sinigang', credit: 'Sinigang na isda · Judgefloro, CC0', source: 'https://commons.wikimedia.org/wiki/File:2050Sinigang_na_Isdan_04.jpg'}
        ]
      }]
    },
    vn: {name: 'Vietnam', flag: 'exhibition/media/vn.png', color: '#37827b', dishes: [
      {id: 'banh-canh', quote: "My mother's homemade bánh canh is a practical family meal that everyone can eat throughout the day.", name: 'Bánh canh', model: '', video: '', photos: [{"path": "exhibition/media/banh-canh.jpg", "alt": "A bowl of Vietnamese bánh canh noodle soup", "credit": "Kham Tran - www.khamtran.com · CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:Banh-Canh-Noodle-Soup.jpg", "license": "https://creativecommons.org/licenses/by/3.0"}], intro: 'Bánh canh is a Vietnamese soup with thick, chewy noodles.', background: 'Noodles may use rice flour, tapioca starch, or a blend. Broths and toppings vary, with versions featuring crab, fish cakes, or pork.'}
    ]},
    my: {name: 'Malaysia', flag: 'exhibition/media/my.png', color: '#7362a4', dishes: [
      {id: 'nasi-lemak', quoteContext: 'A respondent on Malaysian food culture, speaking about curry.', quote: "Curry represents the different cultural influences in Malaysia blending together.", name: 'Nasi lemak', model: '', video: '', photos: [{"path": "exhibition/media/nasi-lemak.jpg", "alt": "Nasi lemak served on a banana leaf", "credit": "Jpatokal · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Nasi_lemak_on_banana_leaf.jpg", "license": "https://creativecommons.org/licenses/by-sa/4.0"}], intro: 'Nasi lemak centers on rice cooked in coconut milk.', background: 'The dish is commonly served with sambal, cucumber, peanuts, egg, and anchovies. It is eaten for breakfast and throughout the day.'}
    ]},
    id: {name: 'Indonesia', flag: 'exhibition/media/id.png', color: '#b77931', dishes: [
      {id: 'nasi-goreng', quote: "Sharing hometown dishes with friends helps me stay connected to home.", name: 'Nasi goreng', model: '', video: '', photos: [{"path": "exhibition/media/nasi-goreng.jpg", "alt": "A serving of Indonesian nasi goreng", "credit": "Helito · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Nasi_goreng_indonesia.jpg", "license": "https://creativecommons.org/licenses/by-sa/4.0"}], intro: 'Nasi goreng is Indonesian fried rice. Many versions use kecap manis, a sweet soy sauce.', background: 'Recipes vary between regions, households, and street vendors. Fried egg, crackers, or cucumber may accompany the rice.'}
    ]},
    th: {name: 'Thailand', flag: 'exhibition/media/th.png', color: '#9b5272', dishes: [
      {id: 'tom-yum', quote: "Tom yum is not just food, it is a symbol of home.", name: 'Tom yum', model: '', video: '', photos: [{"path": "exhibition/media/tom-yum.jpg", "alt": "Tom yum soup with mushrooms", "credit": "Andy Li · CC0", "source": "https://commons.wikimedia.org/wiki/File:Tom_Yum_Soup_with_mushroom_-_Siam_Siam_2025-09-07.jpg", "license": "http://creativecommons.org/publicdomain/zero/1.0/deed.en"}], intro: 'Tom yum is a Thai hot-and-sour soup often flavored with lemongrass, galangal, makrut lime leaves, and lime juice.', background: 'Tom yum comes in clear and creamy versions. Shrimp is common, and recipes can also feature other proteins or mushrooms.'}
    ]},
    tw: {name: 'Taiwan', flag: 'exhibition/media/tw.png', color: '#5261a0', dishes: [
      {id: 'beef-noodles', quote: "I love discovering new foods in Taiwan like dumplings and beef noodles.", name: 'Beef noodles', model: '', video: '', photos: [{"path": "exhibition/media/beef-noodles.jpg", "alt": "Taiwanese beef noodle soup in a bowl", "credit": "Jjj84206 · CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Taiwanese_Beef_Noodle_Soup.jpg", "license": "https://creativecommons.org/licenses/by-sa/4.0"}], intro: 'Taiwanese beef noodle soup pairs wheat noodles with beef and a savory broth.', background: 'Red-braised and clear broths are both familiar styles in Taiwan. Pickled greens or chili may be added at the table.'},
      {id: 'dumplings', quote: "I love discovering new foods in Taiwan like dumplings and beef noodles.", name: 'Dumplings', model: '', video: '', photos: [{"path": "exhibition/media/dumplings.jpg", "alt": "Green Taiwanese dumplings", "credit": "David Monniaux · CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Green_Taiwanese_ravioli_p1120056.jpg", "license": "http://creativecommons.org/licenses/by-sa/3.0/"}], intro: 'Dumplings are filled dough parcels served with dipping sauces such as soy sauce and vinegar.', background: 'Boiled and pan-fried dumplings are familiar in Taiwan, where they appear in home cooking and casual restaurants.'}
    ]}
  }
};
